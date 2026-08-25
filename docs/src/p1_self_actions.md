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

## One field, not two

The form collects a single field, labelled **Work**. It writes `title`.

`description` is still a column and still NOT NULL: `CreateSelfActionDto` makes
it optional and the service defaults it to an empty string. Nothing was
migrated, so the 7,408 entries written before the merge keep their descriptions,
and both the detail sheet and the edit dialog render that box only when it holds
something. A new entry never shows it.

Search still reads both columns, which is what keeps the older entries findable
by words that only ever appeared in the description.

## Filtering

By name, not by date. The date range was two unlabelled inputs, and the question
people actually ask of this list is whose work it is.

The name filter is `createdById`, and it is shown to anyone who can already see
other people's entries rather than to ADMIN alone, which is who could reach it
before. It only narrows: `list` resolves the department scope separately and
forces `created_by_id = self` for EMPLOYEE regardless of what `createdById`
says, so the picker grants no reach that the caller did not already have.

`search` reads three columns: `title`, `description`, and the creator's
`full_name`. The name is in there because it is the second thing people type
into this box, after a word from the work itself, and because the picker beside
it only helps someone who already knows the exact name to pick.

It grants no reach either, for the same reason and by the same mechanism. The
three-way match is one `OR` inside the clause list that `list` `AND`s together,
so it sits beside the department scope and the EMPLOYEE ownership filter rather
than above them. An employee searching a colleague's name gets their own
entries or nothing. `self-action-search.spec.ts` reads the `where` that reaches
Prisma and fails if that stops being true.

`dateFrom` and `dateTo` remain on the server DTO. Nothing sends them.

## Endpoints

Every endpoint below is open to EMPLOYEE, HOD, MD, EA, PA, and
DEPARTMENT_CONTROLLER. Reads and updates additionally allow ADMIN; creation does
not.

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/self-actions` | create |
| GET | `/self-actions` | list, scoped by department |
| GET | `/self-actions/:id` | detail |
| PATCH | `/self-actions/:id` | edit the work text, priority, and a legacy description |
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
