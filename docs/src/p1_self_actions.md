# Self actions

Files: `server/src/modules/self-actions/`. Client: `client/app/(protected)/self-actions/`,
with hooks in `client/src/hooks/use-self-actions.ts`,
`use-create-self-action.ts`, and `use-update-self-action.ts`.

A self action is work an employee did without being told to. It is the second
half of the scoring model: tasks measure how well you execute instructions,
self actions measure whether you act without them.

## What makes it different from a task

No assigner. No acceptance step. No review step. No due date. The employee
creates it, works on it, and closes it. Nobody approves it.

That sounds like it invites gaming, and it does, which is why the scoring weight
per self action (5 points) is half a task (10 points) and why HODs can see every
self action in their departments.

## Lifecycle

`self_action_status_enum` has four values and no state machine service. The
transition is a plain update through `PATCH /self-actions/:id/status`.

```
OPEN -> ONGOING -> COMPLETED
             \
              -> ABORTED
```

Nothing in the code enforces that order. Any status can move to any status. If
Phase 2 needs stricter behaviour, copy the pattern from
`task-lifecycle.service.ts` rather than adding conditionals inside the service.

`completed_at` is set when the status becomes `COMPLETED`. The scoring service
counts by that column, so a self action created in January and completed in
February counts toward February.

## Departments

A self action can be visible to more than one department through
`self_action_departments`. That is how an employee flags work that helped
another team. HOD visibility is resolved through the same
`DepartmentScopeService` the task queries use.

## Comments and attachments

`self_action_comments` mirrors `task_comments`, including threaded replies via
`parent_comment_id` and an `is_tagged` flag. Attachments go into the shared
`task_attachments` table with `self_action_id` or `self_action_comment_id` set.

The duplication is real. If you change comment behaviour, change it in both
places, or take the opportunity to unify them, which Phase 2 has room for since
the projects module needs a third comment thread anyway. See
[Projects](p2_projects.md).

## Audit trail

`self_action_logs` records every change with an `event_type` varchar, the actor,
and old and new values. Unlike `task_status_logs`, it is not limited to status
changes, so edits to the title or description also land here.

## Endpoints

Every endpoint below is open to EMPLOYEE, HOD, MD, EA, PA, and
DEPARTMENT_CONTROLLER. Reads and updates additionally allow ADMIN; creation does
not.

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/self-actions` | create |
| GET | `/self-actions` | list, scoped by department |
| GET | `/self-actions/:id` | detail |
| PATCH | `/self-actions/:id` | edit title, description, priority |
| PATCH | `/self-actions/:id/status` | change status |
| DELETE | `/self-actions/:id` | soft delete via `deleted_at` |
| GET | `/self-actions/:id/comments` | thread |
| POST | `/self-actions/:id/comments` | reply |

Attachments are handled by the attachments module, not here:

| Method | Path |
| --- | --- |
| POST | `/attachments/upload/self-actions/:actionId` |
| POST | `/attachments/upload/self-actions/:actionId/comments/:commentId` |
| GET | `/attachments/self-actions/:actionId` |
| GET | `/attachments/self-actions/:actionId/comments/:commentId` |

## Indexes

`self_actions` carries two composite indexes built for the common listings:

```
(created_by_id, deleted_at, created_at)
(status, deleted_at, created_at)
```

Both lead with the filter columns and end with the sort column. If you add a new
listing with a different filter, add a matching index rather than relying on the
single-column ones.
