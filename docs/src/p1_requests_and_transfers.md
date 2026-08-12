# Requests and transfers

Two modules that look similar and do different things. Requests are an employee
asking for something. Transfers are a department handing a task to another
department.

# Requests

Files: `server/src/modules/requests/`. Table: `task_requests`.

## Two shapes in one table

`task_requests` serves two workflows that happen to share a table.

**Generic requests** are `BUDGET_APPROVAL`, `TRANSPORT_SUPPORT`,
`CROSS_DEPT_ASSISTANCE`, `RESOURCE_REQUEST`, and `OTHER`. An employee describes
what they need. A superior approves or rejects. On approval, the service creates
a real task and stores its id in `generated_task_id`, so the approved request
becomes tracked work rather than an entry in a list nobody revisits.

**Task reassignment** is `TASK_REASSIGNMENT`. An employee asks for a specific
task to be moved to a specific colleague. It uses a different set of columns on
the same row: `task_id`, `task_title`, `task_description`,
`current_assignee_id`, `requested_assignee_id`, `request_reason`.

`RequestsService.create()` branches on the type in its first line and routes
reassignments to `createTaskReassignment()`. Approval and rejection branch the
same way. If you are reading the service and a code path does not make sense,
check which of the two workflows you are in.

## Guards on reassignment

`createTaskReassignment()` refuses in two cases, both worth keeping:

The target task must be active. If its status is `COMPLETED`, `REJECTED`,
`CLOSED`, or `REVIEWED`, the request is rejected with a 403. There is no point
reassigning finished work.

Only one pending reassignment may exist per task at a time. The service queries
for an existing `PENDING` reassignment on the same `task_id` before creating a
new one.

## Idempotent approval

Both approval paths run inside a transaction and update with a compound where
clause:

```ts
where: { id, status: request_status_enum.PENDING, generated_task_id: null }
```

If two approvers click at the same time, the second update matches zero rows and
the transaction fails rather than creating a duplicate task. This is the pattern
to copy anywhere Phase 2 adds an approval step. Leave management in particular
has the same double-click problem, and the same fix applies. See
[Leave management](p2_leave.md).

Every approval and rejection writes an `audit_logs` row with the old and new
values serialised as JSON, and fires notifications to the requester and, for
reassignments, to both the current and the requested assignee.

## Endpoints

| Method | Path | Roles |
| --- | --- | --- |
| POST | `/requests` | EMPLOYEE, HOD, EA, PA, DEPT_CONTROLLER, PURCHASE_HEAD |
| GET | `/requests` | above plus MD |
| GET | `/requests/:id` | above plus MD |
| PATCH | `/requests/:id/approve` | HOD, MD, EA, PA, DEPT_CONTROLLER, PURCHASE_HEAD |
| PATCH | `/requests/:id/reject` | HOD, MD, EA, PA, DEPT_CONTROLLER, PURCHASE_HEAD |

Note that MD can read requests but is not in the create list, and employees can
create but not approve. That asymmetry is intentional.

Attachments on a request go into `task_attachments` with `request_id` set.

# Transfers

Files: `server/src/modules/transfers/`. Table: `task_transfers`.

A transfer moves an existing task from one department to another. Both sides
have to agree: the sending side initiates, the receiving side accepts or
rejects.

## Validation on create

`TransfersService.create()` checks four things before writing the row:

1. The task exists.
2. No other `PENDING` transfer already exists for this task.
3. The initiator's department scope includes the task's current department,
   unless their scope is unrestricted (MD).
4. The destination department is not the current department.

The third check uses `DepartmentScopeService`, which is why a HOD who heads
three departments can transfer tasks out of any of them.

## What approval actually does

Approval runs a transaction that does four things:

```
1. task_transfers.status  -> ACCEPTED, received_by_id set
2. tasks.department_id    -> the destination department
3. task_departments       -> insert (task_id, to_dept_id)
4. audit_logs             -> old and new status
```

Step 2 rewrites the task's owning department, which changes who can see it,
who scores for it, and who gets escalated to when it goes overdue. Step 3 adds
a row to the multi-department join table without removing the old one, so the
originating department keeps read visibility of the task's history.

Rejection sets the status to `REJECTED`, records a `rejection_reason`, and
writes an audit row. The task does not move.

Both paths notify the other side using `TRANSFER_REQUESTED`,
`TRANSFER_ACCEPTED`, and `TRANSFER_REJECTED`.

## Endpoints

| Method | Path | Roles |
| --- | --- | --- |
| POST | `/transfers` | HOD, MD |
| GET | `/transfers` | HOD, MD |
| GET | `/transfers/:id` | HOD, MD |
| PATCH | `/transfers/:id/approve` | HOD, MD |
| PATCH | `/transfers/:id/reject` | HOD, MD |

Transfers are deliberately narrower than requests. Employees cannot initiate
one, and neither can EA, PA, or department controllers, even though those roles
can do most other HOD-level actions. If Phase 2 needs to widen this, widen the
`@Roles` list and add the department scope check to match, because the service
currently assumes the caller is a HOD or MD.
