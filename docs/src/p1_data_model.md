# Data model

Source of truth is `server/prisma/schema.prisma`. This page explains the shape
and the parts that are not obvious from reading the file.

## Naming, and why it is inconsistent

Most tables are `snake_case` and plural (`tasks`, `users`, `task_comments`).
They were introspected from an existing SQL schema with `prisma db pull`, which
is why the relation field names are ugly things like
`users_tasks_assigned_by_idTousers`.

A later group of tables is `PascalCase` in Prisma with an `@@map` to a
snake_case table name: `OtpVerification`, `PasswordResetRequest`, `Visitor`,
`Visit`, `VisitorImage`. Those were written by hand in Prisma first. Their
columns are `camelCase` where the older tables use `snake_case`.

Both styles are load bearing. Do not normalise them in a drive-by change; the
column names are referenced across a lot of raw SQL in the HOD score module.

## Identity

`users` is the centre of the schema. Every other table points at it.

Fields worth knowing:

- `role` is a `role_enum` with eight values, described in [Auth and roles](p1_auth_and_roles.md)
- `department_id` is the single home department. Nullable, but a CHECK
  constraint named `users_employee_has_department` requires it for an
  EMPLOYEE. The other roles keep their departments in the join tables below
  and this column is deliberately null for them.
- `pending_approval` gates a signed-up user who has not been approved yet
- `must_change_password` forces a password change on next login
- `can_access_career_hr` is the flag that lets this user into CareerX
- `deleted_at` is a soft delete; almost every read filters on it

`departments` is a flat list with `sort_order` and `is_active`. There is no
hierarchy.

Three join tables express multi-department membership:

- `hod_departments` (hod_id, department_id) for HODs heading several departments
- `assistant_departments` (assistant_id, department_id) for EA, PA, and department controller
- `task_departments` and `self_action_departments` for work visible to several departments

If you are writing a query that filters by department, read
[Architecture](p1_architecture.md#department-scoping) first. Filtering on
`users.department_id` alone is wrong for four of the eight roles.

`registration_requests` holds a self-signup before approval. It carries its own
`password_hash` so the account can be created on approval without asking again.

`OtpVerification` (`otp_verifications`) stores bcrypt-hashed OTPs with a type
and an expiry. It is reused for two things: the six-digit code emailed during
password reset, and the short-lived reset token issued after the code is
verified. Both are stored in the same table with the same `otpHash` column.

`PasswordResetRequest` (`password_reset_requests`) is a separate flow: an
employee asks an MD, HOD, EA, or PA to reset their password, and the approver
generates a temporary password.

## Work

`tasks` is assigned work.

- `assigned_by_id` is required, `assigned_to_id` is nullable (a task can exist before it is given to anyone)
- `department_id` is the owning department
- `parent_task_id` allows subtasks, self-referential
- `status`, `task_type`, `priority`, `category` are all enums with defaults
- Timestamps for each lifecycle stage: `accepted_at`, `completed_at`, `reviewed_at`, `closed_at`
- Soft delete with `deleted_at`, `deleted_by_id`, `delete_reason`

`task_type` has two values. `OFFICIAL` is a normal top-down task.
`EMPLOYEE_SHARED` is a task an employee raised and shared with colleagues,
handled by a separate controller (`modules/tasks/employee-sharing.controller.ts`).

`self_actions` is self-initiated work. Simpler: `created_by_id`, a title, a
description, a priority, a status, and a `completed_at`. Its status enum is
distinct from the task one: `OPEN`, `ONGOING`, `COMPLETED`, `ABORTED`.

`task_status_logs` records every task status change with from, to, actor, and
reason. `self_action_logs` does the same for self actions but is more general:
it has an `event_type` varchar rather than a status pair, so it also records
edits.

## Collaboration

`task_comments` and `self_action_comments` are near-identical tables, each with
self-referential `parent_comment_id` for threaded replies and an `is_tagged`
flag for mentions. They were not unified, so a change to comment behaviour has
to be made twice.

`task_attachments` is the one table that is shared. It has five nullable
foreign keys and exactly one of them is set per row:

- `task_id` for a file on a task
- `comment_id` for a file on a task comment
- `self_action_id` for a file on a self action
- `self_action_comment_id` for a file on a self action comment
- `request_id` for a file on a request

There is no database constraint enforcing that exactly one is set. The
application is responsible for it.

## Workflow

`task_requests` is the employee request system. Its `type` enum covers
`BUDGET_APPROVAL`, `TRANSPORT_SUPPORT`, `CROSS_DEPT_ASSISTANCE`,
`RESOURCE_REQUEST`, `TASK_REASSIGNMENT`, and `OTHER`. The table carries two
sets of fields because it does two jobs:

The generic request fields are `title`, `description`, `type`, `priority`,
`department_id`, `status`, `rejection_reason`.

The reassignment fields are `task_id`, `task_title`, `task_description`,
`current_assignee_id`, `requested_assignee_id`, `request_reason`. These are
only populated for `TASK_REASSIGNMENT`.

`generated_task_id` is a unique nullable link to a task created when the request
was approved.

`task_transfers` moves a task between departments. It has `from_dept_id`,
`to_dept_id`, `initiated_by_id`, `received_by_id`, a status, and both a `reason`
and a `rejection_reason`.

`task_escalations` records that an escalation fired for a task at a given level.
The table is written by the escalation service, which currently does not run.

## Measurement

`performance_scores` has a unique key on `(user_id, month, year)` and a long
list of numeric columns:

`self_productivity_score`, `assigned_task_score`, `final_score`,
`self_actions_completed`, `self_actions_total`, `consistency_days`,
`total_working_days`, `self_pending_rate`, `assigned_tasks_completed`,
`assigned_tasks_total`, `overdue_tasks_count`, `avg_completion_speed_score`,
`superior_remarks_score`, `is_finalized`.

Most of those columns are never written. The scoring service only fills
`final_score`, `assigned_task_score`, `assigned_tasks_completed`,
`self_actions_completed`, and `overdue_tasks_count`. The rest were designed for
the dual-metric model in the original spec and are still zero. See
[Scoring](p1_scoring.md).

`incentives` has employee, approver, month, year, type, amount, and an approval
flag. There is no incentives module in the API. Nothing writes to this table.
The client has an `/incentives` page and an `incentives.ts` api module; they
read from the dashboard endpoint.

`audit_logs` is generic: user, action, entity, entity_id, old value, new value,
IP. It is indexed on `(entity, entity_id)` and `user_id`.

## Notifications

`notifications` is per-user, with a `notification_type_enum` of eighteen values,
an optional `task_id`, and a free-form `metadata` string. There is no
`is_archived`, no grouping, and no delivery channel column. Everything is
in-app. Email is sent separately and is not recorded against the notification
row.

## Visitor management

Five models, all `PascalCase`, all mapped to snake_case tables:

`Visitor` is a person who visits, with contact details, a status
(`ACTIVE`, `BLACKLISTED`, `INACTIVE`, `ARCHIVED`), a blacklist reason, and a
`faceRecognitionConsent` flag.

`Visit` is one visit by one visitor. It has a `hostEmployeeId` pointing at
`users`, a status, a unique `visitCode`, check-in and check-out timestamps, QR
pass issue and expiry, and columns for face and Aadhaar verification
(`faceVerifiedAt`, `faceMatchScore`, `aadhaarVerifiedAt`).

`VisitorImage` holds photos, typed by `VisitorImageType`
(`PROFILE`, `FACE_REFERENCE`, `AADHAAR_FRONT`, `AADHAAR_BACK`, `VISIT_CAPTURE`,
`OTHER`) and sourced by `VisitorImageSource`.

`Visit.branchId` is a UUID with no foreign key and no branches table. It is a
placeholder for multi-branch support that was never built.

The face recognition columns are also unused: nothing computes
`faceMatchScore` or sets `faceVerifiedAt`. The schema was built ahead of the
feature.

## Enum reference

| Enum | Values |
| --- | --- |
| `role_enum` | MD, EA, PA, DEPARTMENT_CONTROLLER, PURCHASE_HEAD, HOD, EMPLOYEE, ADMIN |
| `task_status_enum` | CREATED, ASSIGNED, ACCEPTED, IN_PROGRESS, COMPLETED, REJECTED, PENDING, REVIEWED, CLOSED, HOD_VERIFIED_PENDING, HOD_VERIFIED |
| `task_priority_enum` | LOW, MEDIUM, HIGH, CRITICAL |
| `task_type_enum` | OFFICIAL, EMPLOYEE_SHARED |
| `task_category_enum` | OPERATIONAL, SALES, MARKETING, PRODUCTION, MAINTENANCE, HR, FINANCE, OTHER |
| `self_action_status_enum` | OPEN, ONGOING, COMPLETED, ABORTED |
| `self_action_priority_enum` | LOW, MEDIUM, HIGH, CRITICAL |
| `request_type_enum` | BUDGET_APPROVAL, TRANSPORT_SUPPORT, CROSS_DEPT_ASSISTANCE, RESOURCE_REQUEST, OTHER, TASK_REASSIGNMENT |
| `request_status_enum` | PENDING, ACCEPTED, REJECTED |
| `transfer_status_enum` | PENDING, ACCEPTED, REJECTED |
| `escalation_level_enum` | EMPLOYEE_REMINDER, HOD_ALERT, MD_ALERT |
| `notification_type_enum` | 18 values, see the schema |
| `incentive_type_enum` | MONETARY, EMPLOYEE_OF_MONTH, GIFT, APPRECIATION_BADGE, PROMOTION_FLAG, CONSISTENCY_AWARD, DEPARTMENT_RANKING |
| `score_status_enum` | NEUTRAL, CALCULATED |
| `registration_status_enum` | PENDING, APPROVED, REJECTED |
| `VisitStatus` | SCHEDULED, CHECKED_IN, CHECKED_OUT, CANCELLED, NO_SHOW, EXPIRED |
| `VisitorStatus` | ACTIVE, BLACKLISTED, INACTIVE, ARCHIVED |

## assistant_exchanges

One question and its answer, written after the answer completes. Nothing reads
it on the request path: conversation history is sent by the client.

| Column | Notes |
| --- | --- |
| `conversation_id` | Generated by the client when the panel opens |
| `user_id` | Who asked. No relation, like every Phase 2 table |
| `question`, `answer` | Verbatim |
| `tools_used` | Tool names in call order. Empty means the model answered without one, which for a tier 1 assistant almost always means it declined |
| `declined` | The queue for whoever writes the next tool, read through `GET /assistant/declines` |
| `feedback` | `1` or `-1` from the thumbs, null until rated. This is the eval set growing itself |
| `input_tokens`, `output_tokens`, `cached_tokens` | Per question cost |

Several enums are declared and never used: `action_status_enum`,
`otp_purpose_enum` (the code uses `OtpType` instead), and `UserStatus`.
