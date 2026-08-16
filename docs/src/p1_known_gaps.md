# Known gaps and dead code

Everything on this page is verified against the code, not inferred from the
spec. If you are about to build something and it looks half finished, check
here first.

Ordered roughly by how much damage the gap causes.

## The escalation engine never runs

`server/src/modules/escalation/` contains a complete service and a cron
decorated with `@Cron(CronExpression.EVERY_DAY_AT_9AM)`. `EscalationModule` is
not in the `imports` array of `AppModule`. Nest never instantiates it, so the
cron is never registered.

Consequences:

- No employee is ever reminded that a task is overdue
- No HOD alert fires at 3 days overdue
- No MD alert fires at 5 days overdue
- `task_escalations` is empty
- `ESCALATION_HOD`, `ESCALATION_MD`, and `TASK_OVERDUE` notifications are never sent
- The `task:overdue` socket event has no producer

The fix is one line in `app.module.ts`. Before you ship it, understand that
turning it on will immediately generate a notification for every task that is
currently overdue, which after months of operation could be a large number.
Run the sweep against production data first and count what it would send.

The escalation thresholds, once it runs, are:

| Days overdue | Who is notified |
| --- | --- |
| 1 to 2 | the assignee |
| 3 to 4 | every active HOD of the task's department |
| 5 or more | every active MD |

The three branches are exclusive: `continue` after each. A task 5 days overdue
notifies the MD only, not the HOD and not the assignee.

The service also has an N+1 problem. It loops over every overdue task and awaits
`createNotification()` one at a time. With a few hundred overdue tasks and
several MDs that is a lot of sequential round trips. Batch the writes before
enabling it.

## Lifecycle timestamps are off by one stage

In `tasks.service.ts`:

```ts
case IN_PROGRESS: return { accepted_at: now };
case COMPLETED:   return { completed_at: now };
case REVIEWED:    return { completed_at: now };
case CLOSED:      return { reviewed_at: now };
case REJECTED:    return { closed_at: now };
```

Entering `CLOSED` writes `reviewed_at`. Entering `REJECTED` writes `closed_at`.
Entering `REVIEWED` overwrites `completed_at`.

The scoring service reads `completed_at` and `reviewed_at`, so scores are
currently computed from columns whose names do not describe what they hold. The
numbers are not obviously wrong, because every task that reaches the end of the
lifecycle has both columns populated, but any report that says "average time to
review" is measuring something else.

Do not fix this in isolation. Fixing the mapping changes historical scores.
The safe sequence is: write a migration that recomputes the columns from
`task_status_logs`, which has the true history, then fix the switch, then
recalculate `performance_scores`.

## The scoring model does not match the specification

The Phase 1 spec describes a dual-metric 50/50 model producing a score out of
100. The code implements unbounded points arithmetic. Eight columns on
`performance_scores` exist for the spec model and are permanently zero.

Details are in [Scoring](p1_scoring.md). The important part for planning: if the
client believes they are getting the documented model, that is a Phase 2 feature
and not a bug fix, and it needs the formula agreed in writing before anyone
writes code.

## `overdue_tasks_count` counts all time, not the month

In `saveMonthlyScores()`:

```ts
this.prisma.tasks.count({
  where: { assigned_to_id: user.id, status: { notIn: [...] },
           due_date: { lt: new Date() } },
})
```

No lower bound on `due_date`, so this counts every overdue task the user has
ever had. The penalty used in the score calculation does have a lower bound.
The stored column and the score therefore disagree, and any report reading the
column reports a larger number than the score reflects.

## PerformX does not expose the employees endpoint CareerX calls

`CareerX/server/src/integrations/performx/performx.client.ts` has
`getEmployees()`, which calls:

```shell
GET {PERFORMX_API_URL}/api/v1/internal/employees
```

PerformX has exactly one internal controller,
`modules/departments/internal-departments.controller.ts`, serving
`/internal/departments`. There is no `/internal/employees`.

`CareerX/server/src/scheduler/employee-sync.cron.ts` runs every 6 hours and
calls that method. It gets a 404, the client turns that into
`ServiceUnavailableException`, and the sync fails silently every 6 hours.
CareerX's `hr_employees` table is therefore populated by some other means or is
stale.

Fixing it means adding an `InternalEmployeesController` to PerformX that returns
`{ id, fullName, email, departmentId, role, isActive }`, guarded by
`InternalApiGuard`. The CareerX client already handles both `camelCase` and
`snake_case` keys and both a bare array and a `{ data: [...] }` envelope, so the
shape is forgiving.

## No incentives module

`incentives` table, `incentive_type_enum`, `INCENTIVE_APPROVED` notification
type, a client page at `/incentives`, and `client/src/api/incentives.ts` all
exist. There is no server module. Nothing writes to the table.

The client page reads whatever the dashboard endpoint returns. The Phase 2 scope
document does not mention incentives, which is worth raising with the client
because the Phase 1 spec lists it as an in-scope module.

## No database migrations

Migrations now exist. What follows is what was actually found when they were
established on 2026-08-16, because the previous state was worse than this
chapter described and the details explain the shape of the migration directory.

`prisma/migrations/` held ten hand-written directories and no
`migration_lock.toml`, which is the tell that none of them came from
`prisma migrate dev`. `_prisma_migrations` existed on production with zero rows.
So Prisma believed nothing had been applied while the schema said otherwise.

Nine of the ten were effectively applied, by hand or by `db push`. One was not:
`20260703184500_add_performance_indexes` was present on disk and **zero of its
twenty-four indexes existed in production**. The composite `deleted_at` indexes
that `p1_conventions.md` describes as making the soft-delete filter free were
not there at all. They are now, as
`20260816120000_add_performance_indexes`.

The database had also drifted from `schema.prisma` in two places, both dead
weight rather than live data:

- `self_actions.department_id`, superseded by the `self_action_departments` join
  table. All 288 non-null values were already represented there and no
  `self_action` lacked a join row.
- `visitors.company_name`, a leftover of the camelCase rename. The live column
  is `visitors."companyName"`; every row of `company_name` still held the
  `Unknown Company` default.

Both are dropped in `20260816120100_drop_legacy_columns`, kept apart from the
index migration so the destructive half is reviewable on its own.

Two traps remain worth knowing:

`prisma db push` is now a recipe that refuses to run. It is how the schema
drifted from its own migrations, and it has no rollback.

The Prisma CLI cannot use `DATABASE_URL`. That is Supabase's transaction pooler
on 6543, which cannot hold the session-level advisory lock migrate takes, so a
migrate command against it hangs until something kills it rather than failing
with a message that says why. `server/prisma.config.ts` points the CLI at
`DIRECT_URL` instead. The running API is unaffected: `PrismaService` builds its
own adapter from `process.env.DATABASE_URL` and never reads that config.

## The `PENDING` task status is unreachable

`task_status_enum.PENDING` appears in no transition in
`task-lifecycle.service.ts`. Nothing sets it. `GET /tasks/pending` and the HOD
scoring queries both treat it as meaningful. Either wire it up or remove it from
the enum and the queries.

## Two comment tables

`task_comments` and `self_action_comments` are structurally identical.
Threaded replies, tagging, and attachment handling are implemented twice. Phase
2 adds a third thread for projects. Unifying into one polymorphic
`comments` table before writing the third copy is worth doing; see
[Projects](p2_projects.md).

## Unused schema

Columns and enums that nothing reads or writes:

- `Visit.faceVerifiedAt`, `faceMatchScore`, `aadhaarVerifiedAt`
- `VisitorImage.isFaceTemplate`, `faceEmbeddingVersion`, `faceMatchScore`
- `Visit.branchId` (no branches table, no foreign key)
- `VisitStatus.NO_SHOW` and `VisitStatus.EXPIRED` (nothing sets them)
- `action_status_enum`, `otp_purpose_enum`, `UserStatus` (superseded by `OtpType`)
- Eight zero-filled columns on `performance_scores`

Leave them. Dropping columns from a live table is a bigger operation than the
tidiness is worth, and several of them will be needed if the descoped features
come back.

## `is_finalized` is always true

`saveMonthlyScores()` sets `is_finalized: true` on every nightly run, including
mid-month. Nothing reads the flag. If Phase 2 introduces a month-end lock, this
column is where it belongs, and the nightly job needs to stop setting it.

## Duplicated Supabase key names

The code reads both `SUPABASE_SERVICE_KEY` and `SUPABASE_SERVICE_ROLE_KEY`, in
different files, for the same credential. Set both to the same value. Picking one
and deleting the other is a five minute change nobody has made.

## Socket gateway CORS is wide open

`@WebSocketGateway({ namespace: '/performx', cors: { origin: '*' } })`. The
handshake still requires a valid JWT so this is not currently an exposure, but
it should be narrowed to the same allowlist as the HTTP server before Phase 2
adds external vendor accounts.

## Loose scripts in version control

`server/query.ts`, `verify.ts`, `get_depts.ts`, `check-ea-pa.ts`,
`check-latest.ts`, `dept-query.ts`, `nest-query.ts`, `pg-query.js`, `query.sql`,
`backend-vms-architecture.txt`, and `client/update-api.js`, `update-api2.js`,
`update-dialog.js`, `update-typo.js`.

All one-off debugging or codemod scripts. None are imported by the application.
They should be deleted or moved to a `scripts/` directory that is clearly not
part of the build.

## No tests, no linting, no CI

Neither `package.json` configures a test runner. The client has a `lint` script
with no config file. Nothing runs on push.

Given Phase 2 touches the scoring engine, the approval flows, and the schema,
at minimum the scoring calculation should get unit tests before it is changed.
It is pure arithmetic over Prisma counts and is the easiest thing in the
codebase to test.
