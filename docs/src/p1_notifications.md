# Notifications and realtime

Files: `server/src/modules/notifications/` (service, controller, gateway) and
`server/src/modules/email/`. Client: `client/src/config/socketClient.ts`,
`client/src/hooks/useSocket.ts`, `client/src/api/notifications.ts`.

## How a notification gets created

Every module that needs to tell someone something calls
`NotificationsService.createNotification()`. The signature is small:

```ts
createNotification({
  recipientId: string,
  type: notification_type_enum,
  title: string,
  message: string,
  taskId?: string,
  metadata?: string,
})
```

It writes a `notifications` row and emits over the socket to that user's room.
There is no queue, no retry, and no delivery guarantee. If the write succeeds
the notification exists; if the socket emit misses because the user is offline,
they will see it on their next page load because the bell reads from the table,
not from the socket.

Email is a separate call to `EmailService`, which wraps Resend. Nothing links an
email to its notification row. `notifications` has no channel column, so you
cannot tell from the database whether a given alert was also emailed. Phase 2
fixes this; see [Notification engine rebuild](p2_notifications.md).

## The eighteen types

`notification_type_enum` is a flat list with no grouping:

```
TASK_ASSIGNED       TASK_ACCEPTED       TASK_REJECTED
TASK_COMPLETED      TASK_PENDING        TASK_OVERDUE
ESCALATION_HOD      ESCALATION_MD       REQUEST_ACCEPTED
REQUEST_REJECTED    REMARKS_ADDED       TASK_TAGGED
INCENTIVE_APPROVED  TRANSFER_REQUESTED  TRANSFER_ACCEPTED
TRANSFER_REJECTED   REVIEW_REQUESTED    PASSWORD_RESET
```

Two of these are never emitted. `INCENTIVE_APPROVED` has no producer because
there is no incentives module. `ESCALATION_HOD` and `ESCALATION_MD` have a
producer in `escalation.service.ts`, but that service never runs because
`EscalationModule` is not imported into `AppModule`. See
[Known gaps](p1_known_gaps.md).

Adding a type means editing the Prisma enum and pushing the schema. That is a
migration on a production table, so batch new types together rather than adding
them one at a time.

## Endpoints

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/notifications` | paginated list for the current user |
| GET | `/notifications/unread-count` | badge count |
| PATCH | `/notifications/:id/read` | mark one read |
| DELETE | `/notifications/:id` | delete one |

There is no mark-all-read and no bulk delete. CareerX has
`PATCH /notifications/read-all`; PerformX does not. Users with a few hundred
unread rows have to click each one.

The table is indexed on `(user_id, created_at)` and `(user_id, is_read)`, so
both the list and the badge count are cheap.

## The Socket.IO gateway

`notifications.gateway.ts`, namespace `/performx`.

### Connection

The client sends the JWT either in `handshake.auth.token` or as an
`Authorization: Bearer` header. The gateway verifies it with `JwtService`. On
failure it logs `Socket Auth Failed` and disconnects without telling the client
why, which is a small debugging annoyance: a client that silently fails to
receive events almost always has a bad or expired token.

On success it joins three kinds of room:

```
user:<sub>                      one per connection
department:<id>                 one per department in the token
role:<ROLE>                     one per connection
```

The department list is built from `payload.departmentId` plus
`payload.departmentIds`, deduplicated. That is why the login token has to carry
both fields for multi-department users; drop `departmentIds` and HODs stop
receiving department broadcasts for their secondary departments.

### Task rooms

Clients join and leave a per-task room explicitly:

```ts
socket.emit('task:join', taskId)
socket.emit('task:leave', taskId)
```

The task detail page joins on mount and leaves on unmount. This is how live
comments arrive without polling.

### Events the server emits

| Event | Room | Sent when |
| --- | --- | --- |
| `notification:new` | `user:<id>` | any notification is created |
| `dashboard:refresh` | `user:<id>` | the dashboard should refetch |
| `task:updated` | `task:<id>` | a task changes |
| `task:comment:new` | `task:<id>` | a comment is added |
| `task:overdue` | `task:<id>` | a task passes its due date |

`task:overdue` has no producer today for the same reason the escalation
notifications do not fire.

### Helper methods

The gateway exposes `sendToUser`, `sendToDepartment`, `sendToRole`,
`sendToTask`, and `broadcast`, plus named wrappers `notifyUser`,
`refreshDashboard`, `taskUpdated`, `taskCommentAdded`, and `taskOverdue`. Use
the named wrappers from services so the event name lives in one place.

### CORS

The gateway is configured with `origin: '*'`. The HTTP server is not. Tightening
this to the same allowlist is a small, safe change and should happen before
Phase 2 adds vendor accounts, since vendors are external users.

## Email

`EmailService` wraps Resend. It needs `RESEND_API_KEY` and
`RESEND_FROM_EMAIL`. It is used for the OTP password reset flow and for a
handful of task events.

There are no HTML templates in PerformX. CareerX has ten of them under
`src/modules/email/templates/` and they are a good pattern to copy when Phase 2
needs leave approval and project deadline emails.

## Client wiring

`client/src/config/socketClient.ts` creates the socket with the stored JWT.
`client/src/hooks/useSocket.ts` subscribes components to events and handles
cleanup.

The convention that matters: when a socket event arrives, invalidate the
relevant TanStack Query key rather than writing the payload into the cache by
hand. Server state stays authoritative and you avoid the class of bug where the
socket payload and the REST response disagree about the shape of a record.
