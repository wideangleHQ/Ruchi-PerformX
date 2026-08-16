# Notification engine rebuild

One engine that every module calls, with a delivery channel per notification
type, so that adding a module does not mean reinventing how it tells people
things.

Design this in Week 1 even though it ships in Week 4. Every module built in
weeks 1 to 3 emits notifications. If the interface does not exist when they are
written, each one invents its own call and Week 4 becomes a rewrite of six
modules rather than an integration.

## What exists today

`NotificationsService.createNotification()` writes a `notifications` row and
emits a socket event. That is all. Read
[Notifications and realtime](p1_notifications.md) for the current state.

What it does not do:

- Send email. `EmailService` is a separate call that nothing correlates with the notification row
- Record which channel a notification went out on
- Handle a failure. No retry, no queue, no dead letter
- Support mark-all-read
- Reference anything other than a task. `notifications.task_id` is the only entity link

## Target shape

Keep `createNotification()` as the entry point so existing callers do not break.
Change what happens inside it.

```ts
interface NotifyInput {
  recipientId: string;
  type: notification_type_enum;
  title: string;
  message: string;
  entityType?: 'task' | 'self_action' | 'request' | 'transfer'
             | 'leave' | 'project' | 'poll' | 'visit' | 'rnd' | 'asset';
  entityId?: string;
  channels?: notification_channel_enum[];   // defaults from the type
  metadata?: Record<string, unknown>;
}
```

The engine:

1. Writes the `notifications` row with `entity_type` and `entity_id`.
2. Emits `notification:new` to `user:<recipientId>` over the socket.
3. Looks up the default channels for this notification type.
4. Dispatches to each channel that is not `IN_APP`.

Schema additions in [Schema changes](p2_data_model.md#notifications).

## Channel routing

A static map from notification type to default channels. Put it in a constants
file next to the service, following the pattern of
`hod-score.constants.ts`.

```ts
export const NOTIFICATION_CHANNELS: Record<notification_type_enum, Channel[]> = {
  TASK_ASSIGNED:          ['IN_APP'],
  TASK_OVERDUE:           ['IN_APP'],
  ESCALATION_HOD:         ['IN_APP', 'EMAIL'],
  ESCALATION_MD:          ['IN_APP', 'EMAIL'],
  LEAVE_SUBMITTED:        ['IN_APP', 'EMAIL'],
  LEAVE_APPROVED:         ['IN_APP', 'EMAIL'],
  LEAVE_REJECTED:         ['IN_APP', 'EMAIL'],
  LEAVE_HR_CANCELLED:     ['IN_APP', 'EMAIL'],
  PROJECT_DEADLINE_NEAR:  ['IN_APP'],
  PROJECT_OVERDUE_NO_CLOSURE: ['IN_APP', 'EMAIL'],
  PROJECT_CLOSED:         ['IN_APP', 'EMAIL'],
  VENDOR_TASK_ASSIGNED:   ['IN_APP', 'EMAIL'],
  VENDOR_CONTRACT_EXPIRING: ['IN_APP', 'EMAIL'],
  VISITOR_ARRIVED:        ['IN_APP'],
  // ...
};
```

Two rules for deciding what gets email:

Anything that needs action from someone who might not be in the app right now
gets email. Approvals, escalations, and vendor assignments qualify.

Anything high frequency does not. Task status changes and project messages
arrive dozens of times a day and emailing them trains people to filter the
sender, which then loses the important ones too.

Per-user preferences are not in scope. If the client asks, it is a
`notification_preferences` table keyed on `(user_id, type)` overriding the
static map, and the lookup goes in the same place. Do not build it speculatively.

## Delivery

**Do not add BullMQ to PerformX for this.** CareerX runs BullMQ with Redis
because it has heavy work: resume parsing, bulk email, and report generation.
PerformX has none of that, and adding a queue means a worker process, a
deployment change, and a new failure mode, for volume that a direct call
handles.

Send email inline, catch failures, log them, and never let an email failure roll
back the notification write:

```ts
async notify(input: NotifyInput) {
  const row = await this.prisma.notifications.create({ data: {...} });
  this.gateway.notifyUser(input.recipientId, row);

  const channels = input.channels ?? NOTIFICATION_CHANNELS[input.type] ?? ['IN_APP'];
  if (channels.includes('EMAIL')) {
    this.sendEmail(row).catch(err =>
      this.logger.error(`Email failed for notification ${row.id}: ${err.message}`),
    );
  }
  return row;
}
```

The in-app notification is the source of truth. Email is best effort. A user
whose email bounced still sees the bell.

Revisit this if volume grows past a few thousand a day, or if the WhatsApp
add-on happens, since WhatsApp providers rate limit and retries matter.

## Batching

The escalation service loops over every overdue task and awaits
`createNotification()` one at a time. With a few hundred overdue tasks that is
hundreds of sequential round trips. See
[Known gaps](p1_known_gaps.md#the-escalation-engine-never-runs).

Add a bulk path:

```ts
async notifyMany(inputs: NotifyInput[]) {
  const rows = await this.prisma.notifications.createManyAndReturn({ data: [...] });
  for (const row of rows) this.gateway.notifyUser(row.user_id, row);
  // email dispatch grouped by recipient
}
```

Use it from escalation, from project deadline sweeps, and anywhere else a cron
notifies a list.

## Email templates

PerformX has no email templates. CareerX has ten of them under
`CareerX/server/src/modules/email/templates/`, each a function returning a
subject and an HTML body. Copy that pattern.

Templates Phase 2 needs:

```
leave-submitted          to the manager
leave-approved           to the applicant
leave-rejected           to the applicant, includes the remark
escalation-hod           to the HOD
escalation-md            to the MD
project-closure          to the MD
project-deadline         to the lead
vendor-task-assigned     to the vendor
asset-handover           to the receiving employee
```

A rejection email that does not carry the approver's remark is worse than no
email, because the recipient then has to go and ask. Put the remark in the body.

## The new endpoint

```
PATCH /notifications/read-all
```

PerformX does not have it and CareerX does. Users with hundreds of unread rows
currently have to click each one. Add the index from
[Schema changes](p2_data_model.md#notifications) with it.

Consider also:

```
GET /notifications?entityType=leave&unreadOnly=true
```

Filtering by entity type is what makes a notification centre usable once there
are ten modules producing them.

## New notification types

Roughly twenty-five new values on `notification_type_enum`. Add them in one
migration rather than one per module; each addition is a schema change against
a live table. This list is the source of truth. If a module page adds a type,
it has to land here too, or the migration will be written from a stale list.

```
LEAVE_SUBMITTED           LEAVE_APPROVED           LEAVE_REJECTED
LEAVE_CANCELLED           LEAVE_HR_CANCELLED
PROJECT_INVITED           PROJECT_CHECKLIST_UPDATED PROJECT_MESSAGE
PROJECT_DEADLINE_NEAR     PROJECT_OVERDUE_NO_CLOSURE
PROJECT_CLOSED            PROJECT_CLOSURE_SUBMITTED
POLL_CREATED              BIRTHDAY_TODAY
RND_REPORT_SUBMITTED      RND_TEAM_ADDED
ASSET_HANDOVER_INITIATED  ASSET_HANDOVER_CONFIRMED
VENDOR_TASK_ASSIGNED      VENDOR_TASK_UPDATED      VENDOR_MESSAGE
VENDOR_CONTRACT_EXPIRING  VENDOR_DOCUMENT_EXPIRING VENDOR_DELIVERABLE_DUE
VISITOR_ARRIVED           VISITOR_REQUEST_APPROVED
```

Leave is single stage, so there is no separate manager and HR pair here.
`LEAVE_APPROVED` and `LEAVE_REJECTED` cover both approvers and the body says
who acted. `LEAVE_CANCELLED` is the employee withdrawing a pending
application; `LEAVE_HR_CANCELLED` is HR cancelling an already-approved one and
crediting the balance back. They read differently to the applicant, so they are
different types. See [Leave management](p2_leave.md#notifications).

`PROJECT_DEADLINE_NEAR` is the reminder to the Lead before the date.
`PROJECT_OVERDUE_NO_CLOSURE` is the escalation to the MD after it passes with
no closure report. See [Projects](p2_projects.md#deadlines).

The three `VENDOR_*_EXPIRING` and `_DUE` types are driven by the vendor
deadline sweep and go to the internal owner, never to the vendor. See
[Vendor management](p2_vendors.md#8-deadline-and-renewal-tracking).

`BIRTHDAY_TODAY` is questionable. A birthday card on the dashboard may be
enough, and a notification for every birthday in a hundred-person company is
noise. Ask before building it.

## Migrating existing callers

Existing calls pass `taskId`. Keep supporting it: if `taskId` is set and
`entityType` is not, write `entity_type: 'task'` and `entity_id: taskId`. That
lets old callers keep working while new modules use the general form, and lets
the client query uniformly.

Backfilling old rows is optional. `task_id` is still populated on them and the
notification list can read either.

## Testing

The one part of this worth a test: the channel routing map. It is a pure
function from a notification type to a list of channels, it is the thing most
likely to be edited carelessly, and getting it wrong means either silence or
spam. A single test asserting that every value in `notification_type_enum` has
an entry in `NOTIFICATION_CHANNELS` catches the most likely mistake, which is
adding an enum value and forgetting the map.
