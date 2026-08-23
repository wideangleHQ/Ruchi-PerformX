# Home dashboard: birthdays, holidays, polls, analytics

The home dashboard stops being a task summary and becomes the screen people
open first in the morning. Four additions, none of them technically hard, all of
them visible to every employee every day.

Because this is the most-seen surface in the product, the bar for polish is
higher here than anywhere else in Phase 2.

## Birthday cards

**Data.** One new column: `users.date_of_birth`, a `DATE` and nullable.

**Rule.** On a date matching someone's birthday, a card appears on every
employee's home dashboard. It disappears at end of day. Multiple birthdays on
one day means multiple cards.

**Query.** Match month and day, ignore the year:

```sql
SELECT id, full_name, department_id
FROM users
WHERE date_of_birth IS NOT NULL
  AND deleted_at IS NULL
  AND is_active = true
  AND EXTRACT(MONTH FROM date_of_birth) = EXTRACT(MONTH FROM CURRENT_DATE)
  AND EXTRACT(DAY   FROM date_of_birth) = EXTRACT(DAY   FROM CURRENT_DATE)
```

Do not build a `birthday_cards` table. There is nothing to store. The card is a
derived view of a column that already holds the answer, and a table would need a
job to populate it and another to expire it.

29 February needs a decision. Show it on 28 February in non-leap years, or on
1 March, or not at all. Pick one, write it in the query, and mention it in the
handover note so nobody thinks it is a bug.

**Privacy.** Some people do not want their birthday broadcast. The column is
nullable and the UI should let a user clear it from their own profile. Do not
make it mandatory at signup.

**Endpoint.** `GET /dashboard/birthdays` returning today's list. Or fold it into
the existing `GET /dashboard` payload, which saves a round trip on the busiest
screen in the app. Prefer folding it in.

## Holidays

Built as part of [Leave management](p2_leave.md#endpoints) because leave
validation depends on it, but it surfaces here.

**Dashboard banner.** The next upcoming holiday, with a countdown in days.
`GET /holidays/upcoming` returns the next few; the banner shows the first.

**Full calendar.** A read-only year view for employees, editable by HR.

**Ordering constraint.** Holidays must land before or with the leave module,
because leave's overlap validation reads this table. If it slips, leave ships
with that rule disabled.

## Polls

**Tables.** `polls`, `poll_options`, `poll_votes`. Definitions in
[Schema changes](p2_data_model.md#dashboard-social-layer).

**Rules.**

Any employee can raise a poll. Not just management.

Polls are not anonymous. The creator's name is shown alongside the question.
This is explicit in the scope document and it is a product decision, not an
oversight: accountability is the point.

One vote per person per poll, enforced by the unique key on
`(poll_id, user_id)`, not by an application check. A unique violation on insert
means they already voted; catch it and return the current results.

Results are live. Votes appear as they come in, not after the poll closes.

Polls appear on every relevant user's dashboard until `closes_at` passes or
`is_closed` is set.

**Changing a vote.** Not specified. Default to allowing it: an `upsert` on
`(poll_id, user_id)` instead of an `insert`. It is one word of code and it is
what people expect.

**Closing.** Either a cron that flips `is_closed` when `closes_at` passes, or
compute "is this poll open" at read time from `closes_at`. The second needs no
job and cannot silently fail. Keep the `is_closed` column for manual early
closure by the creator.

**Endpoints.**

| Method | Path | Who |
| --- | --- | --- |
| GET | `/polls/active` | all, feeds the dashboard |
| GET | `/polls` | all, includes closed |
| POST | `/polls` | any internal user |
| GET | `/polls/:id` | all, includes results and the caller's vote |
| POST | `/polls/:id/vote` | all, one per person |
| PATCH | `/polls/:id/close` | creator, MD |
| DELETE | `/polls/:id` | creator, MD |

`GET /polls/:id` returning the caller's own vote alongside the results is what
lets the UI render the right state on first paint without a second call.

**Realtime.** Broadcast a `poll:updated` event on the socket when a vote lands,
carrying the new tallies. Live results updating without a refresh is what makes
a poll feel worth using. Broadcast to everyone; polls are company wide.

**Screens.** A poll card on the dashboard showing the question, the creator, the
options with vote counts and bars, and the total. Before voting, the options are
buttons. After voting, they are results with the caller's choice marked.

The dashboard shows open polls only, so `/polls` is the archive: every poll
newest first, filtered to all, open or closed. It is `GET /polls` and the same
card, because a closed poll already renders as results. Reached from the All
polls link in the dashboard's poll header rather than a sidebar entry, which is
where somebody looking for a poll they voted in last week goes first.

## Scoring and analytics

Builds on the existing engines rather than replacing them. Read
[Scoring](p1_scoring.md) first, and in particular understand that the employee
scoring engine does not implement the model the Phase 1 specification describes.

**What the scope document asks for:**

Department-level and individual-level performance trends for MD and HOD. The
HOD score module already produces a company matrix and a six-month trend series;
this is largely a presentation job.

Employees viewing their own score trend and its composition. This one has a
problem: the employee score is unbounded points, not a percentage, and its
composition is four numbers that are not stored. `performance_scores` keeps
`assigned_tasks_completed`, `self_actions_completed`, and `overdue_tasks_count`,
which is enough to show a breakdown but not enough to show the arithmetic.

**Recommendation.** Before building the employee-facing trend screen, decide
whether the employee score model is being fixed in this phase. If it is not,
show the three stored counts and the total, and do not label the total as a
percentage or a rating out of anything. Showing an unbounded points number as
though it were a score out of 100 will produce complaints that no amount of UI
work will fix.

If the model is being fixed, that is a scoped piece of work with its own
sequence: agree the formula in writing, implement it, recalculate history,
then build the screen. It does not fit in the analytics allocation.

**Endpoints.** Mostly existing:

| Method | Path | Status |
| --- | --- | --- |
| GET | `/hod-score/company` | exists |
| GET | `/hod-score/trends` | exists, 6 months |
| GET | `/hod-score/department/:id` | exists |
| GET | `/scoring/me/trend` | new, employee's own history |
| GET | `/scoring/department/:id/trend` | new, for HOD and MD |

`ScoringService` currently has no controller at all. Adding one is
straightforward; the service methods `getEmployeeScore`, `getDepartmentScore`,
and `getLeaderboard` already exist and are unreachable over HTTP.

## Dashboard payload

`GET /dashboard` already returns a different shape per role. Phase 2 adds:

```
birthdays:      today's list
upcomingHoliday: the next one with a day count
activePolls:    open polls with the caller's vote state
```

Keep it one call. The dashboard is the screen that loads on every login and
splitting it into five requests to five endpoints makes the first paint worse
for no benefit. If the payload gets large, paginate the lists inside it rather
than splitting the endpoint.

## A note on the visual bar

Everything on this page is seen by every employee every day. Birthday cards,
poll results, and a holiday countdown are the parts of the product people will
form an opinion about, more than the task lifecycle they use twice a week.

Budget accordingly. This module has ₹18,000 against ₹35,000 for the whole HR
suite, which undervalues it relative to its visibility.
