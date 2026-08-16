# Scoring

There are two scoring engines in this codebase and they do not share code, do
not share a formula, and do not agree with the original spec. Read this page
before touching either.

- `modules/scoring/` scores individual employees. Simple points arithmetic.
- `modules/hod-score/` scores HODs. Six weighted components computed in SQL.

# Employee scoring

Files: `server/src/modules/scoring/scoring.service.ts` and `scoring.cron.ts`.

## The formula that is actually implemented

```ts
const POINTS = {
  TASK_COMPLETED: 10,
  SELF_ACTION_COMPLETED: 5,
  TASK_REVIEWED: 5,
  OVERDUE_PER_DAY: -2,
  ESCALATED: -10,
};
```

`calculateEmployeeScore(userId, month, year)` runs four counts over the month
window and adds them up:

1. Tasks where `assigned_to_id = user` and `completed_at` falls in the month,
   times 10.
2. Tasks where `assigned_to_id = user` and `reviewed_at` falls in the month,
   times 5.
3. Self actions where `created_by_id = user`, status `COMPLETED`, and
   `completed_at` in the month, times 5.
4. For every currently open task assigned to the user whose `due_date` has
   passed and falls in the month, subtract 2 per day overdue, and subtract a
   further 10 if it is 5 or more days overdue.

The result is clamped with `Math.max(0, score)`. There is no upper bound, so the
number is unbounded points, not a percentage.

Counting by `completed_at` rather than by status is deliberate. A task that
reaches `CLOSED` still has `completed_at` set, so it is counted once rather than
being counted again under each later status.

## Where this disagrees with the spec

The Phase 1 specification describes a dual-metric model: a self productivity
score and an assigned task score, each computed independently and combined
50/50 into a final score out of 100. That model is not implemented.

The `performance_scores` table still has the columns for it:
`self_productivity_score`, `self_actions_total`, `consistency_days`,
`total_working_days`, `self_pending_rate`, `assigned_tasks_total`,
`avg_completion_speed_score`, `superior_remarks_score`. All of them are left at
their default of zero.

What `saveMonthlyScores()` actually writes:

| Column | Value |
| --- | --- |
| `final_score` | the points total |
| `assigned_task_score` | the same points total, duplicated |
| `assigned_tasks_completed` | count of tasks completed this month |
| `self_actions_completed` | count of self actions completed this month |
| `overdue_tasks_count` | count of currently overdue tasks, all time |
| `assigned_score_status` | `CALCULATED` |
| `is_finalized` | `true` |

Note that `overdue_tasks_count` is computed with `due_date: { lt: new Date() }`
and no lower bound, so it counts every overdue task the user has ever had, not
just this month's. The score arithmetic uses a windowed count; the stored column
does not. If a report shows a number that disagrees with the score, this is why.

`is_finalized` is set to `true` on every run, including mid-month runs. The flag
does not mean what its name suggests and nothing reads it.

## The cron

```ts
@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
```

Every night it recomputes and upserts the current month for every active
non-admin user. That means a score for the current month keeps moving until the
month ends, which is intended, but it also means the overdue penalty is
recalculated against `new Date()` every night. A task that has been overdue for
30 days contributes a larger penalty each night until it is closed.

There is no backfill. If the process is down at midnight, that night's
recalculation is simply skipped and the next night's run covers it, because the
job recomputes from source data rather than accumulating.

## Other methods

`calculateDepartmentScore()` averages the live per-employee calculation across a
department's active users.

`getDepartmentScore()` averages the stored `final_score` rows instead. The two
can disagree, because one recomputes and the other reads what was last saved.
Prefer the stored version for reporting so numbers do not move while someone is
reading them.

`getLeaderboard(month, year)` returns the top 10 by `final_score` with the
user's name, role, and department name.

## Endpoints

Phase 2 put a controller in front of the stored rows. Nothing recomputes on
read; every route reads `performance_scores` as the cron last wrote it.

| Method | Path | Returns |
| --- | --- | --- |
| GET | `/scoring/me` | the caller's own row for a month |
| GET | `/scoring/me/trend` | the caller's own history, oldest month first |
| GET | `/scoring/leaderboard` | top 10 by points |
| GET | `/scoring/department/:departmentId` | the stored department average |
| GET | `/scoring/department/:departmentId/trend` | department history plus one series per member |

`score-trend.ts` holds the series assembly as pure functions, tested in
`score-trend.spec.ts`. A month with no stored row is emitted as a gap rather
than dropped, because dropping it draws five bars as though they were six
consecutive months. A user with no rows at all returns an empty series, so the
screen shows "no history" instead of a row of gaps that reads as bad months.

The department routes resolve membership through `users.department_id`, the same
as `getDepartmentScore`. That column does not describe the four
multi-department roles, so it is never used to decide access: who may call these
is `DepartmentScopeService`, checked in the controller.

# HOD scoring

Files: `server/src/modules/hod-score/`. This is the more serious engine:
1000 lines of service, mostly one large aggregate SQL query returning one row
per HOD, cached in Redis.

## The six components

From `hod-score.constants.ts`. The weights sum to 1.

| Component | Weight | What it measures |
| --- | --- | --- |
| `taskCreation` | 0.25 | Tasks created against an expected target |
| `selfAction` | 0.20 | The HOD's own self actions and how many distinct days they logged them |
| `departmentCompletion` | 0.25 | Completion rate across the department's tasks |
| `departmentHealth` | 0.15 | Pending and overdue load in the department |
| `activeParticipation` | 0.10 | Distinct active days and how many features were used |
| `leadershipBonus` | 0.05 | Review turnaround and request turnaround |

`TASKS_PER_EMPLOYEE_TARGET` is 6. The expected task count for a HOD is
6 times the number of employees in their departments, so 5 employees means 30
expected tasks in a month.

## Status lists

The SQL classifies task statuses with two hardcoded lists:

```ts
COMPLETED_TASK_STATUSES = ['COMPLETED', 'CLOSED', 'REVIEWED', 'HOD_VERIFIED']
PENDING_TASK_STATUSES   = ['CREATED', 'ASSIGNED', 'PENDING']
```

`ACCEPTED`, `IN_PROGRESS`, `HOD_VERIFIED_PENDING`, and `REJECTED` are in
neither list. Tasks in those states count toward the department total but toward
neither the completed nor the pending numerator. If you add a status to
`task_status_enum`, decide which list it belongs to here or it will quietly
distort every HOD's score.

## Timezone

`SCORE_TIMEZONE` defaults to `Asia/Kolkata` and is used to derive month
boundaries and to count distinct calendar days. This exists so that "distinct
days on which the HOD logged a self action" does not change depending on which
region the server happens to be running in. Do not replace it with server local
time.

## Caching

Computed matrices are cached in Redis for 30 minutes under a key that includes
`HOD_SCORE_CACHE_VERSION`, currently `v1`. Bumping that constant invalidates
every cached matrix at once, which is the intended way to ship a formula change.

Redis is used for nothing else in PerformX. If Redis is unavailable the module
recomputes on every request, which is slow but correct.

## Access control

The controller stacks four guards: `JwtAuthGuard`, `RolesGuard`,
`HodScoreAccessGuard`, and `ThrottlerGuard`. The extra access guard exists
because a HOD may read their own score and their own departments' scores but not
another HOD's. `MIN_SCORE_YEAR` is 2020 and rejects earlier years, which stops
someone probing the endpoint with a range of years to enumerate structure.

## Endpoints

| Method | Path | Returns |
| --- | --- | --- |
| GET | `/hod-score/me` | the caller's own score for a period |
| GET | `/hod-score/company` | the full company matrix |
| GET | `/hod-score/trends` | 6 months of history (`TREND_MONTHS`) |
| GET | `/hod-score/department/:departmentId` | one department |
| GET | `/hod-score/:hodId` | one HOD, subject to the access guard |

# Incentives

There is no incentives module. The `incentives` table exists, the
`incentive_type_enum` exists, `INCENTIVE_APPROVED` exists in the notification
enum, and the client has an `/incentives` page and an `incentives.ts` api
module. Nothing on the server writes to the table.

The client page reads figures from the dashboard endpoint. Building the real
module is Phase 2 work and is not currently in the Phase 2 scope document, which
is worth raising with the client before the phase starts.

# If you are asked to unify the two engines

Do not start by merging the code. Start by deciding which number is the one the
business acts on. Today the employee score is unbounded points and the HOD score
is a weighted 0 to 1 value scaled for display. They are not comparable, they are
not on the same scale, and averaging them produces nonsense.

The honest sequence is: agree the formula with the client in writing, write it
into `hod-score.constants.ts` style constants, implement it once, recalculate
history, and delete the loser. Do not run both and let the reports pick.
