# Architecture

## The pieces

```
Browser (Next.js 16, port 4001)
   |
   |  REST over axios, Bearer JWT in the Authorization header
   |  Socket.IO on the /performx namespace
   v
NestJS 11 API (port 4000, global prefix /api/v1)
   |
   +-- Prisma 7 --> PostgreSQL (Supabase)
   +-- Supabase JS --> Storage buckets (attachments, visitor photos)
   +-- Resend --> outbound email
   +-- @nestjs/schedule --> cron jobs in-process
   +-- Redis --> HOD score cache only
```

There is no message queue, no separate worker process, and no horizontal
scaling. Every cron job runs inside the same process that serves HTTP. This is
fine at roughly 100 users and will not be fine later; CareerX already runs the
BullMQ setup that PerformX will eventually need.

Production hosts: the client is on Vercel at `app.ruchiperformx.in`, the API is
at `api.ruchiperformx.in`, and the database and object storage are on Supabase.

## How the client gets deployed

Nothing deploys on push, and nothing in this repository deploys production.

Vercel's own git integration is off, because `client/vercel.json` sets
`deploymentEnabled: false`. That leaves `.github/workflows/ci.yaml` as the only
automated path, and it builds previews only:

```
schedule   30 18 * * *   18:30 UTC, midnight IST, every day
dispatch   Actions -> Vercel Preview Deployment -> Run workflow
```

So there is always a preview URL showing roughly yesterday's `main`, and anyone
who needs a fresher one can press the button.

**Production is deployed by hand from Vercel**, by someone who decides the code
is ready. There is no `--prod` anywhere in the workflow and adding one is a
decision, not a tidy-up. The reasoning is in the
[decision log](decisions.md).

Three things follow.

The preview URL is up to a day behind `main` unless somebody dispatches it, so
it is not a check on a commit you just pushed.

GitHub disables scheduled workflows after sixty days without a push to the
repository, and it does so quietly. A long quiet period stops the daily preview
and nothing announces it.

The API is not deployed by this workflow and never has been.

## Request path

Every request that is not marked `@Public()` goes through two global guards,
registered as `APP_GUARD` providers in `server/src/app.module.ts`:

`JwtAuthGuard` (`common/gaurds/jwt-auth.guard.ts`, note the misspelled
directory) reads the `Authorization: Bearer` header and verifies the token. It
does something unusual: it looks at the request path, and if the path contains
`/vms/` it verifies against `VMS_JWT_SECRET` instead of `JWT_SECRET`, then
checks that the payload carries `scope: 'vms'`. On non-VMS paths it tries the
main secret first and falls back to the VMS secret. Either way the decoded
payload is attached to `request.user`.

`RolesGuard` (`common/gaurds/roles.guard.ts`) reads the `@Roles(...)` metadata
off the handler or the controller class and checks `user.role` against it. If a
handler has no `@Roles` decorator, the guard lets everything through, so an
endpoint without `@Roles` is open to any authenticated user.

After the guards, the global `ValidationPipe` in `main.ts` runs with
`whitelist`, `forbidNonWhitelisted`, and `transform` all enabled. Unknown
properties in a request body are not ignored, they cause a 400. That is
deliberate and it catches a lot of frontend and backend drift, but it also means
adding a field to a form without adding it to the DTO produces a confusing
error.

## Module layout

```
server/src/
  main.ts                 bootstrap, global prefix, CORS, validation pipe
  app.module.ts           module wiring and the two global guards
  prisma/                 PrismaService
  common/
    constants/            VMS JWT config
    decorators/           @Roles, @Public, @CurrentUser
    gaurds/               JwtAuthGuard, RolesGuard, InternalApiGuard
    helpers/              department-query.helper.ts
    services/             DepartmentScopeService, RedisService
    types/                JwtPayload, VmsJwtPayload
  modules/
    auth/                 login, register, OTP reset, token verify
    users/                CRUD, approvals, password resets
    departments/          CRUD plus the internal sync endpoint
    tasks/                task lifecycle and employee-shared tasks
    self-actions/         self-initiated work
    requests/             employee requests
    transfers/            cross-department task transfers
    comments/             task comments
    attachments/          file upload and retrieval
    notifications/        REST plus the Socket.IO gateway
    email/                Resend wrapper
    scoring/              monthly employee scores and its cron
    hod-score/            the six-component HOD scoring engine
    escalation/           overdue escalation service and cron (see note)
    dashboard/            aggregation for the home screen
    profile/              current user profile
    vms/                  visitor management, a subsystem in its own right
```

`escalation` is written but not imported into `AppModule`, so its cron never
runs. See [Known gaps](p1_known_gaps.md).

## Department scoping

A user's visibility is not just their role. A HOD can head several departments,
and an EA or PA can be attached to several. Three join tables carry this:

- `hod_departments` maps a HOD to the departments they head
- `assistant_departments` maps an EA, PA, or department controller to departments
- `users.department_id` is the single home department for ordinary employees

`common/services/department-scope.service.ts` resolves a JWT payload into the
list of department IDs that user may see, and caches the result per request. Any
query that lists tasks, users, or self actions should go through it or through
`common/helpers/department-query.helper.ts` rather than filtering on
`users.department_id` directly. Filtering on the single column is the most
common correctness bug in this codebase because it silently hides a
multi-department HOD's other departments.

## Client layout

```
client/
  app/
    (public)/       login, signup, verify-otp, forgot/reset password
    (protected)/    dashboard, tasks, self-actions, requests, transfers,
                    scoring, hod-score, analytics, incentives, notifications,
                    profile, settings, admin, career
    vms/            reception and employee visitor flows, separate shell
  src/
    api/            one axios module per backend domain
    hooks/          TanStack Query wrappers
    context/        AuthContext
    config/         queryClient, socketClient
    lib/            validation, attachment upload, task validation
  components/ui/    shadcn primitives
```

Route groups map to shells, not to URLs. `(protected)` renders the sidebar and
enforces auth on the client; `vms` renders the reception shell with its own
navigation.

Data fetching is TanStack Query on top of a shared axios instance in
`src/api/client.ts`. The convention is one file per backend domain in
`src/api/`, exporting plain async functions, with the query and mutation hooks
sitting in `src/hooks/`. Components should call hooks, not the api functions
directly.

`client/proxy.ts` exists but there is no `middleware.ts` in this app, unlike
CareerX. Route protection is client side only, through `AuthContext`. That is
acceptable because the API enforces authorization on every endpoint, but it does
mean a protected page will briefly render before redirecting.

## Realtime

`modules/notifications/notifications.gateway.ts` is a Socket.IO gateway on the
`/performx` namespace. On connection it verifies the JWT from
`handshake.auth.token` or the `Authorization` header, then joins the socket to
three kinds of room:

- `user:<userId>` for personal notifications
- `department:<departmentId>` for each department the user belongs to
- `role:<ROLE>` for role-wide broadcasts

Clients can also join `task:<taskId>` by emitting `task:join`, which is how the
task detail page receives live comments.

The gateway's CORS is `origin: '*'`, which is wider than the HTTP CORS
allowlist. That is worth tightening but it is not currently a data exposure
because the handshake still requires a valid JWT.

Server-to-client events in use: `notification:new`, `dashboard:refresh`,
`task:updated`, `task:comment:new`, `task:overdue`.

## Scheduled work

`@nestjs/schedule` decorators, all running in the API process:

| Job | Schedule | File |
| --- | --- | --- |
| Recalculate and store monthly scores | daily at midnight | `modules/scoring/scoring.cron.ts` |
| Overdue escalation sweep | daily at 09:00 | `modules/escalation/escalation.cron.ts` (not wired up) |

Both `ScoringModule` and `EscalationModule` call `ScheduleModule.forRoot()`
independently. That is harmless because `forRoot` is idempotent, but the right
shape is one `forRoot()` in `AppModule` and plain imports elsewhere.

## Where the boundaries are

Things that are genuinely separate and should stay separate:

The VMS subsystem signs its own tokens with its own secret and its own
`scope: 'vms'` claim. Reception staff log in with a numeric access code, not a
username and password. Do not blend VMS auth into the main auth module.

CareerX is a different database and a different deploy. PerformX exposes exactly
one endpoint for it today (`GET /api/v1/internal/departments`, protected by
`InternalApiGuard`) plus the public `POST /api/v1/auth/verify` used during the
SSO exchange. Everything else CareerX needs, it caches locally.
