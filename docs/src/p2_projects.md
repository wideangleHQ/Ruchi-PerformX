# Projects

A structured replacement for the ad-hoc WhatsApp group. A project is a
short-term goal with members from any department, a checklist, a message
thread, a deadline, and a mandatory closure report that lands on the MD's desk.

## How this differs from tasks

Tasks are hierarchical. Somebody assigns work down and reviews it coming back
up. Projects are flat. Anybody can start one, membership crosses departments,
and there is no approval to join.

Do not build projects on top of `tasks`. The lifecycle is different, the
authorization model is different, and bolting a second mode onto
`task-lifecycle.service.ts` would make the task state machine worse for
everyone. Separate tables, separate module.

## Tables

`projects`, `project_members`, `project_checklist_items`, `project_messages`,
`project_outcomes`, `project_closure_reports`, and the two enums. Definitions in
[Schema changes](p2_data_model.md#projects).

Read [the note on unifying comments](p2_data_model.md#unifying-comments) before
building `project_messages`. This is the third message table in the codebase and
the last good moment to consolidate.

## Rules

**Anyone can create a project.** Including an employee. The creator becomes the
lead by default, recorded both as `projects.lead_id` and as a
`project_members` row with `role = 'LEAD'`.

**Membership crosses departments.** The invite picker lists every active user,
not the creator's department. This is deliberate; the whole point is
cross-departmental collaboration.

**Visibility is company wide, participation is not.** Every employee can see the
project directory and open a project to read its checklist and outcomes. Only
members can post messages, tick checklist items, or log outcomes. The scope
document asks for a directory of "active, completed, and archived projects
across the company," which only works if reading is open.

Vendors are the exception. A vendor sees only projects listed for them in
`vendor_assignments`. See [Vendor management](p2_vendors.md).

**Closure is mandatory.** A project cannot move to `COMPLETED` without a
`project_closure_reports` row. Enforce it in the service and let the unique
constraint on `project_id` stop duplicates.

**The closure report goes to the MD.** On submission, notify every active MD
and set `md_viewed_at` when one of them opens it. That column is what lets you
answer "has the MD seen this yet."

## Outcome logging

`project_outcomes` records three kinds of entry:

| `entry_type` | Meaning |
| --- | --- |
| `TRY` | An attempt that was made |
| `FAILURE` | Something that did not work, and why |
| `OUTCOME` | A result achieved |

This is the part of the module the client cares most about and the part
engineers are most likely to skip, because it looks like a comment thread with
extra steps. It is not. The distinction between an attempt, a failure, and a
result is what makes a closed project readable six months later. Give each type
its own visible affordance in the UI, not a dropdown on a generic entry form.

Failures being first-class is unusual and worth preserving. Do not let it turn
into a status field.

## Deadlines

`projects.deadline` is nullable. When set, a daily cron reminds the lead as the
date approaches. Suggested schedule: 7 days out, 1 day out, and on the day.

After the deadline passes with no closure report, escalate to the MD. The scope
document says the MD "receives escalation notifications for any project nearing
deadline without a closure report."

Put this in the same cron file as the existing escalation sweep, or in a new one
next to it. Whichever you choose, make sure `EscalationModule` is actually
imported into `AppModule` first, because it is not today. See
[Known gaps](p1_known_gaps.md#the-escalation-engine-never-runs).

## Endpoints

| Method | Path | Who |
| --- | --- | --- |
| POST | `/projects` | any authenticated internal user |
| GET | `/projects` | all, filter by status |
| GET | `/projects/mine` | projects the caller is a member of |
| GET | `/projects/:id` | all, vendors only if assigned |
| PATCH | `/projects/:id` | lead only |
| DELETE | `/projects/:id` | lead, MD, soft delete |
| POST | `/projects/:id/members` | lead |
| DELETE | `/projects/:id/members/:userId` | lead |
| GET | `/projects/:id/checklist` | all readers |
| POST | `/projects/:id/checklist` | members |
| PATCH | `/projects/:id/checklist/:itemId` | members |
| DELETE | `/projects/:id/checklist/:itemId` | lead |
| GET | `/projects/:id/messages` | members |
| POST | `/projects/:id/messages` | members |
| GET | `/projects/:id/outcomes` | all readers |
| POST | `/projects/:id/outcomes` | members |
| POST | `/projects/:id/closure` | lead, ADMIN, MD |
| GET | `/projects/:id/closure` | all readers |
| PATCH | `/projects/:id/close` | lead, requires closure report to exist |

Membership checks are service-layer work. `RolesGuard` cannot express
"is a member of this project" because it only sees the role on the JWT. Write a
private `assertMember(projectId, userId)` helper in the service and call it at
the top of every members-only method. Do not reimplement the check inline five
times.

## Screens

**Project directory.** Cards or a table, filterable by status and by
"my projects." Show the lead, member avatars, checklist progress as a fraction,
and the deadline with an overdue indicator.

**Project detail.** Tabs or panels for checklist, messages, and outcomes.
Checklist progress and deadline visible at the top regardless of which panel is
open.

**Closure report form.** Summary, outcome, learnings. Only reachable by the lead
and only when the project is `ACTIVE`. After submission the project moves to
`COMPLETED` and the form becomes a read-only view.

**MD closure inbox.** A list of submitted closure reports with unread ones
marked. This is the payoff for the whole module from the MD's side and it should
not be buried inside the project detail page.

## Realtime

Project messages are the obvious candidate for the socket gateway. Add a
`project:<id>` room following the existing `task:<id>` pattern in
`notifications.gateway.ts`, with `project:join` and `project:leave` handlers and
a `project:message:new` event.

Checklist ticks are also worth broadcasting. Two people working the same list
and seeing each other's ticks is the difference between this and a shared
document.

## Event management

Low priority in the scope document, and the first thing to cut if the month runs
short. Cutting it breaks nothing else.

Tables: `events`, `event_coordinators`, `event_expenses`. See
[Schema changes](p2_data_model.md#events-low-priority).

The shape is a project with money attached:

- Create an event with a name, date, venue, and coordinators
- Set an estimated budget
- Log expenses against it with an item, an amount, and a receipt
- A post-event summary showing estimated against actual, itemised

Reuse `project_checklist_items` with a nullable `event_id`, or skip checklists
for events entirely. Do not build a second checklist table for this.

Endpoints follow the same shape as projects. Coordinators are the equivalent of
members. Expenses need an upload path for receipts, which goes to the existing
Supabase bucket with a new prefix.

The budget variance report is the deliverable the client actually wants. If time
is short and you build only one screen for events, build that one.
