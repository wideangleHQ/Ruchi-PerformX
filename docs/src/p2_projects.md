# Projects

A structured replacement for the ad-hoc WhatsApp group. A project is a
collaborative workspace with members from any department, a checklist,
milestones, KPIs, a message thread, a timeline, and a mandatory closure
report. No MD review gate — completion is a Lead/Co-Lead action.

## How this differs from tasks

Tasks are hierarchical. Somebody assigns work down and reviews it coming
back up. Projects are flat and collaborative. Anybody can start one,
membership crosses departments, and there is no approval to join.

**Architecture rule: projects stay independent of tasks.** Do not build
projects on top of `tasks`. Projects are a collaborative workspace; tasks are
individual/hierarchical assigned work; the project checklist is its own
project-specific execution plan owned by the Lead/Co-Lead. Bolting a second
lifecycle onto `task-lifecycle.service.ts` would make the task state machine
worse for everyone. Separate tables, separate module.

## Tables

`projects`, `project_members`, `project_checklist_items`,
`project_milestones`, `project_success_criteria`, `project_kpis`,
`project_messages`, `project_outcomes`, `project_activity_logs`,
`project_closure_reports`, and the enums. Definitions in
[Schema changes](p2_data_model.md#projects).

Read [the note on unifying comments](p2_data_model.md#unifying-comments)
before building `project_messages`. This is the third message table in the
codebase and the last good moment to consolidate.

## Project information

Captured at creation or shortly after:

| Field | Notes |
| --- | --- |
| Project Code | auto-generated, immutable |
| Project Name | required |
| Project Type | free text or a small configurable list |
| Category | configurable |
| Priority | e.g. LOW / MEDIUM / HIGH / CRITICAL |
| Objective | required, short |
| Description | required |
| Tags | multiple, freeform |

**UX goal: creation stays quick.** Essential information first — name, type,
objective, deadline. Milestones, KPIs, and success criteria are
optional/expandable sections, not required fields on the creation form. The
project detail page is where it becomes a full workspace.

## Lifecycle

```
DRAFT -> PLANNED -> ACTIVE -> ON_HOLD -> ACTIVE
                        |
                        +--> AT_RISK --> ACTIVE
                        |
                        +--> COMPLETED (requires closure report)
                        |
                        +--> CANCELLED
                                |
ACTIVE / ON_HOLD / AT_RISK / COMPLETED / CANCELLED --> ARCHIVED
```

`project_status_enum`: `DRAFT`, `PLANNED`, `ACTIVE`, `ON_HOLD`, `AT_RISK`,
`COMPLETED`, `CANCELLED`, `ARCHIVED`.

Status transitions are business-rule controlled, not a free-for-all PATCH.
Write an explicit transition table in the service the same way
`task-lifecycle.service.ts` does for tasks, rather than allowing any status
value on any PATCH. `COMPLETED` is only reachable when a
`project_closure_reports` row exists for the project — enforce in the
service and back it with the unique constraint on `project_id`.

## Project health

`project_health_enum`: `ON_TRACK`, `AT_RISK`, `DELAYED`.

Derive it, do not let it be hand-set as a free field: from the deadline
proximity, checklist completion percentage, and count of overdue checklist
items and milestones.

**Recompute it on the daily deadline sweep, not on read.** `health` is a
stored, indexed column and the project directory filters on it, so a value
computed at read time would leave the filter and the index querying stale
rows. The sweep is already walking every project with a deadline (see
Deadlines below), so this costs nothing extra. Anything that changes a
project's inputs mid-day, ticking the last checklist item for example, can
recompute that one row inline.

## Checklist and progress

The Lead and Co-Lead decide and manage the checklist: create, edit, reorder,
and assign items. Items carry title, description, assignee, due date,
priority, and status.

**Progress is calculated from checklist completion**, not entered by hand.
Team members cannot modify overall project progress directly. They can only
tick their assigned items, and the aggregate is computed.

**A member's PATCH is limited to `is_done`, at field level.** Not "members can
edit their own item." A member who can also change `title`, `due_date`,
`priority` or `assigned_to_id` can move their own goalposts, which is the same
thing as editing progress by hand with extra steps. Whitelist the field in the
DTO rather than trusting the UI to only send one key. Lead and Co-Lead get the
full field set.

## Milestones

Fields: name, description, owner, start date, due date, status. Milestones
are visible in the project timeline alongside the deadline, and overdue
milestones are highlighted the same way overdue checklist items are.

## Objectives and success criteria

The objective is a single field on the project (see Project information
above). Success criteria are a separate list — multiple, measurable
criteria attached to the project, each addable/removable independently. Do
not cram them into the objective as one paragraph; they need to be checkable
individually at closure time.

## KPIs

Optional. Fields: metric, target, actual, status. Display KPI performance in
the project overview so it does not require opening a separate tab to see
whether the project is hitting its numbers. Leave them empty for projects
that do not need them — do not force a KPI row per project.

## Team and ownership

One Project Lead, mandatory. One optional Co-Lead. Members cross
departments freely — the invite picker lists every active user, not the
creator's department, because cross-departmental collaboration is the point.

`project_members.role`: `PROJECT_LEAD`, `CO_LEAD`, `MEMBER`, `OBSERVER`.
`OBSERVER` can read everything a member can but cannot post messages, tick
checklist items, or log outcomes — it exists for stakeholders who need
visibility without participation rights.

**Visibility is company-wide, participation is not.** Every employee can see
the project directory and open a project to read its checklist, milestones,
and outcomes. Only members (not observers) can write. Vendors are the
exception: a vendor sees only projects listed for them in
`vendor_assignments`. See [Vendor management](p2_vendors.md).

## Timeline

Start date, target deadline, and the milestone timeline together form the
project timeline view. Overdue items and overdue milestones are highlighted
in the same view, not buried in a separate report.

## Activity log

`project_activity_logs` is an immutable audit history. Insert-only, no
update or delete path in the service layer. Track: member changes, status
changes, checklist changes and completions, deadline changes, milestone
changes, and outcome updates. This is what makes "who changed the deadline
and when" answerable without grepping the database.

## Messages and collaboration

Project-level messaging in `project_messages`, kept deliberately separate
from `project_activity_logs`. Messages are conversation; activity log is
audit trail. Do not merge them — a reader needs to skim the audit trail
without wading through chat.

## TRY / FAILURE / OUTCOME

Retained as-is. `project_outcomes` records three kinds of entry:

| `entry_type` | Meaning |
| --- | --- |
| `TRY` | An attempt that was made |
| `FAILURE` | Something that did not work, and why |
| `OUTCOME` | A result achieved |

This is the part of the module the client cares most about and the part
engineers are most likely to skip, because it looks like a comment thread
with extra steps. It is not. Give each type its own visible affordance in
the UI, not a dropdown on a generic entry form. Failures being first-class
is unusual and worth preserving — do not let it turn into a status field.
These entries become part of the project's permanent knowledge/history.

## Closure report

Required before `COMPLETED`. Fields: Executive Summary, Objective, Final
Outcome, Achievements, Failures, Learnings, KPI Results, Recommendations,
Attachments.

**No MD review.** This is a scope change from the earlier design. There is
no MD approval workflow, no `md_viewed_at` column, no MD inbox gate. Once the
Project Lead or Co-Lead submits the closure report, the project moves to
`COMPLETED` per the normal completion rules, the same status-transition
check as any other lifecycle move, not a separate approval state.

Removing the approval gate does not remove the deadline escalation below.
Those are different things: one is a person blocking a state change, the other
is a notification nobody has to act on.

## Deadlines

`projects.deadline` is nullable. When set, a daily cron reminds the Lead and
Co-Lead as the date approaches. Suggested schedule: 7 days out, 1 day out, and
on the day. That is `PROJECT_DEADLINE_NEAR`.

After the deadline passes with no closure report, escalate to the MD. The scope
document says the MD "receives escalation notifications for any project nearing
deadline without a closure report," and that survives the removal of MD closure
review. That is `PROJECT_OVERDUE_NO_CLOSURE`, and it is the only project
notification the MD gets by default.

Both go through the notification engine, not a direct call. See
[Notification engine](p2_notifications.md).

Put this in the same cron file as the existing escalation sweep, or in a new one
next to it. Whichever you choose, make sure `EscalationModule` is actually
imported into `AppModule` first, because it is not today. See
[Known gaps](p1_known_gaps.md#the-escalation-engine-never-runs).

The same sweep is the natural place to recompute `projects.health`, since it is
already walking every project with a deadline. See Project health above.

## Dashboard

Per-project overview surfaces: status, health, progress, Lead, Co-Lead,
members, deadline, milestones, checklist summary, overdue items, and KPI
summary. This is the single screen that should answer "is this project
okay" without opening any tab.

## Filters

Project directory filters: search, status, health, priority, department,
Project Lead, category, date range, "My Projects", "Overdue", "Due This
Week".

## Database structure

Keep `projects` itself lean — status, health-relevant fields, ownership, and
timeline dates. Push everything else into its own entity:

```
project_members
project_milestones
project_checklist_items
project_success_criteria
project_kpis
project_messages
project_outcomes
project_activity_logs
project_closure_reports
```

See [Schema changes](p2_data_model.md#projects) for the Prisma models.

## Endpoints

| Method | Path | Who |
| --- | --- | --- |
| POST | `/projects` | any authenticated internal user |
| GET | `/projects` | all, filter by status/health/priority/etc. |
| GET | `/projects/mine` | projects the caller is a member of |
| GET | `/projects/:id` | all, vendors only if assigned |
| PATCH | `/projects/:id` | Lead, Co-Lead |
| DELETE | `/projects/:id` | Lead, MD, soft delete |
| POST | `/projects/:id/members` | Lead, Co-Lead |
| DELETE | `/projects/:id/members/:userId` | Lead, Co-Lead |
| GET | `/projects/:id/checklist` | all readers |
| POST | `/projects/:id/checklist` | Lead, Co-Lead |
| PATCH | `/projects/:id/checklist/:itemId` | Lead, Co-Lead any field; members `is_done` only, own assignment only |
| DELETE | `/projects/:id/checklist/:itemId` | Lead, Co-Lead |
| GET/POST | `/projects/:id/milestones` | readers / Lead, Co-Lead |
| PATCH/DELETE | `/projects/:id/milestones/:milestoneId` | Lead, Co-Lead |
| GET/POST | `/projects/:id/success-criteria` | readers / Lead, Co-Lead |
| GET/POST | `/projects/:id/kpis` | readers / Lead, Co-Lead |
| PATCH | `/projects/:id/kpis/:kpiId` | Lead, Co-Lead |
| GET | `/projects/:id/messages` | members (not observers) |
| POST | `/projects/:id/messages` | members (not observers) |
| GET | `/projects/:id/outcomes` | all readers |
| POST | `/projects/:id/outcomes` | members (not observers) |
| GET | `/projects/:id/activity` | all readers |
| POST | `/projects/:id/closure` | Lead, Co-Lead |
| GET | `/projects/:id/closure` | all readers |
| PATCH | `/projects/:id/close` | Lead, Co-Lead, requires closure report to exist |

Membership and role checks are service-layer work. `RolesGuard` cannot
express "is the Lead or Co-Lead of this project" because it only sees the
role on the JWT. Write private `assertMember(projectId, userId)` and
`assertLeadOrCoLead(projectId, userId)` helpers in the service and call them
at the top of every gated method. Do not reimplement the check inline
across every handler.

## Screens

**Project directory.** Cards or a table, filterable per the Filters section
above. Show the Lead, member avatars, checklist progress as a fraction,
health badge, and the deadline with an overdue indicator.

**Project detail.** Tabs or panels for overview (the dashboard fields),
checklist, milestones, KPIs, messages, outcomes, and activity log. Progress,
health, and deadline visible at the top regardless of which panel is open.

**Project edit.** `/projects/:id/edit`, reached from the Edit button on the
detail page. A flat list of what `PATCH /projects/:id` accepts. Three fields it
deliberately leaves out:

- `status`, which the lifecycle control on the detail page owns because it moves
  through the transition table and a select that refuses half its options
  belongs next to what it describes.
- `lead_id`. Handing a project to somebody else is not a select buried in a form
  the Co-Lead can also submit.
- `is_rnd` and `rnd_category` for anyone outside the R&D team. The server
  refuses the change, so the fields render only when `GET /rnd/membership`
  says the caller is a member.

Deleting lives at the bottom of the same screen behind a confirm, and is gated
separately: editing is the Lead or the Co-Lead, deleting is the Lead or the MD.

**Closure report form.** All closure fields from the section above. Only
reachable by the Lead/Co-Lead and only when the project is `ACTIVE`. After
submission the project moves to `COMPLETED` and the form becomes a read-only
view.

## Realtime

Project messages are the obvious candidate for the socket gateway. Add a
`project:<id>` room following the existing `task:<id>` pattern in
`notifications.gateway.ts`, with `project:join` and `project:leave` handlers
and a `project:message:new` event.

Checklist ticks are also worth broadcasting. Two people working the same
list and seeing each other's ticks is the difference between this and a
shared document.

## Event management

Low priority in the scope document, and the first thing to cut if the month
runs short. Cutting it breaks nothing else.

Tables: `events`, `event_coordinators`, `event_expenses`. See
[Schema changes](p2_data_model.md#events-low-priority).

The shape is a project with money attached:

- Create an event with a name, date, venue, and coordinators
- Set an estimated budget
- Log expenses against it with an item, an amount, and a receipt
- A post-event summary showing estimated against actual, itemised

Reuse `project_checklist_items` with a nullable `event_id`, or skip
checklists for events entirely. Do not build a second checklist table for
this.

Endpoints follow the same shape as projects. Coordinators are the equivalent
of members. Expenses need an upload path for receipts, which goes to the
existing Supabase bucket with a new prefix.

The budget variance report is the deliverable the client actually wants. If
time is short and you build only one screen for events, build that one.

### What shipped

Everything above except checklists, which were skipped rather than built:
`ProjectExecutionService` gates every checklist call on project membership and
derives project progress from the same rows, so serving events from it is a
projects change, not an events one. `project_checklist_items.event_id` is still
unused and no second table was added. See the decision log. Routes,
the multipart receipt upload, and the report payload are in
[API reference](p1_api_reference.md#events). Money is a fixed two place string
on every boundary, never a JSON number. Nothing here sends a notification,
because `notification_type_enum` has no event value and the schema is frozen;
if coordinators should be told when they are added to an event, that needs an
enum value first.
