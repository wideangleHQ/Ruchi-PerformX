# KPIs and the PS Score

This chapter describes code that exists. It implements the KPI and PMS
framework document dated September 2026, which the client circulated as a
proposal; where that document leaves a rule to a business decision, this page
says which way the code went and why that choice can be reversed cheaply.

## Two scores, never one

PerformX measures performance twice and keeps the numbers apart.

| Score | Question | Where it comes from |
| --- | --- | --- |
| AT Score | Is this person executing their day-to-day work? | `modules/scoring`, `modules/hod-score` |
| PS Score | Is this person's role delivering the outcome it exists to deliver? | `modules/kpi`, this chapter |

They are never averaged. An employee can close every assigned task on time and
still miss the revenue target their role exists to hit, and one blended figure
would hide which of the two needs attention. `modules/kpi` imports neither
scoring module, and neither imports it.

## Files

```
server/src/modules/kpi/
  kpi-units.ts        the unit library and its search
  kpi-scoring.ts      achievement, score, PS Score, all pure
  kpi-lifecycle.ts    the four statuses, the role matrix, reach, allocation
  kpi-scoring.spec.ts the framework's worked examples as tests
  kpi-lifecycle.spec.ts  role matrix, transitions, reach, weightage
  kpi.service.spec.ts    status on create, assignment, chat and score scoping
  kpi.service.ts
  kpi.controller.ts
  kpi.module.ts
  dto/
client/src/api/kpi.ts
client/src/hooks/useKpi.ts
client/src/components/kpi/
client/app/(protected)/kpis/page.tsx
```

The three files ending in nothing but plain functions are where the arithmetic
lives. They have no Prisma and no Nest in them, which is why the examples in
the framework document can be tested directly rather than through a service.

## The core model

Every quantitative KPI is the same five ingredients:

```
VALUE + UNIT + DIRECTION + TARGET + SCORING METHOD
```

A number means nothing until a unit is attached to it. Ten employees, ten
percent and ten lakh rupees are three different goals built from the same
model, and the difference between them lives in the row, not in the code. Six
departments measuring six different things run through one engine; there is no
department-specific branch anywhere in this module.

### Achievement is not score

This is the idea the whole module is built around, and the one that is easiest
to lose in a refactor.

**Achievement** says how close the actual got to the target. **Score** is what
the KPI's configured rule makes of that achievement. Eighty percent achievement
is 80 under `DIRECT` and can be 100 under a `THRESHOLD` band that treats
anything above 75 as fully met. Both are correct. They are two columns on the
UI and two functions in `kpi-scoring.ts` for that reason.

### Direction

A plain actual ÷ target is wrong for a lot of real KPIs. Five hours against a
four hour target is 125% by division and is worse, not better.

| Direction | Example | Rule |
| --- | --- | --- |
| `HIGHER_IS_BETTER` | Monthly revenue | actual ÷ target |
| `LOWER_IS_BETTER` | Complaint resolution time | target ÷ actual |
| `EXACT_TARGET` | Inventory count at a checkpoint | 100 minus the drift, either way |

An optional `baseline_value` turns any of them into a measure of improvement
rather than absolute level: baseline 60, target 90, actual 75 is 50%, not 83%.

### Measurement modes

| Mode | What the employee does | Scored by |
| --- | --- | --- |
| `QUANTITATIVE` | Enters the actual figure | `DIRECT` or `THRESHOLD` |
| `BINARY` | Ticks completed or not | `DIRECT` or `THRESHOLD` |
| `MILESTONE` | Ticks each stage as it finishes | `MILESTONE` |
| `RATING` | Nothing: a reviewer rates it | `RATING` |

The mode decides which fields are required, in one table (`MODE_RULES` in
`kpi.service.ts`) rather than four branches repeated across three methods.

Milestones count weight, never stages. Three of five complete is 45% when the
three that are done weigh 10, 20 and 15.

### Weight and contribution are different numbers

Weight says how important the goal is. Contribution says how much of it was
this person's. They are multiplied, never merged, which is what stops three
people each taking full credit for one department outcome.

## The PS Score

```
Actual → Achievement → KPI Score → Weight → Contribution → PS Score
```

`psScore()` normalises the weights over the KPIs that actually counted. One
rule does three jobs the framework asks for separately:

- A **deleted** KPI has its weight redistributed rather than zeroed, so a KPI
  dropped for legitimate business reasons cannot fail anybody.
- A KPI with **no update yet** drops out on the same path, so a missing actual
  is not silently a zero. The framework marks that an open business decision;
  the code takes the safe direction and the decision, when it arrives, is a
  change to one function.
- A set whose weights **do not total 100** still produces a number out of 100,
  and the shortfall is reported as `declared_weight` so the UI can say so.

The score is computed on read. There is no cron and no `ps_scores` table: the
KPI rows and their update history are the source, and nothing has asked for
cross-cycle benchmarking yet. Only `PUBLISHED` KPIs count.

## Lifecycle

Four statuses, from the approved KPI specification of October 2026:

```
Authority self KPI:  Create -> PUBLISHED
Employee self KPI:   Create -> PENDING_APPROVAL -> Quick approve -> PUBLISHED
Either, saved first: DRAFT -> submit -> PUBLISHED or PENDING_APPROVAL
Any of them:         -> DELETED (soft, with a reason)
```

| Status | Meaning |
| --- | --- |
| `DRAFT` | Saved, not yet submitted. Holds no allocation and does not score |
| `PENDING_APPROVAL` | An employee's own KPI waiting for a quick approve. Holds allocation, does not score |
| `PUBLISHED` | Live. Takes actuals, milestone ticks and ratings, and counts in the PS Score |
| `DELETED` | Soft deleted. Out of every list unless asked for by status; its updates, revisions and chat stay |

The status is never sent on create. `submittedStatus()` in `kpi-lifecycle.ts`
derives it from the creator's role, so an authority's KPI cannot land in
`PENDING_APPROVAL` by accident and an employee's cannot publish itself.

The ten statuses before this (Approved through Locked, and Cancelled) were
folded in by migration `20261006120000_kpi_four_status_lifecycle_and_chat`:
Approved to Locked became `PUBLISHED`, Cancelled became `DELETED`, and the old
value of every moved row is kept in `kpis.legacy_status`.

### Who does what

| Role | Own KPI | Assign to others | Quick approve |
| --- | --- | --- | --- |
| MD, EA, PA | Create and edit, published | Anyone | Yes |
| HOD, Department Controller | Create and edit, published | Own departments only | Own departments only |
| Employee, and any other role | Create and edit, pending approval | No | No |

"Own departments" is what `DepartmentScopeService` resolves: `hod_departments`
for a HOD, `assistant_departments` for a Department Controller. The check is
`canActOnDepartment()` against the KPI's or the target employee's department,
on the server, for assigning, approving, sending back, deleting, editing
someone else's KPI, contributions and revisions. Nobody approves their own KPI.

An employee edits their own KPI with `PATCH /kpis/:id`. Editing a published one
sends it back to `PENDING_APPROVAL`, because the target that was approved is no
longer the target. An authority's edit leaves the status alone. Either way the
DTO has no creator, owner, department, status or approval field, so an edit
cannot move any of them.

An employee may delete their own KPI while it is a draft or pending. Once it
is published only an authority over its department can, so a KPI cannot be
deleted to drop a bad result.

### Weightage

An employee's own weights do not have to total 100: 25 + 20 + 15 = 60 is a
valid set, and the PS Score normalises over what is there exactly as before.

What is enforced is the ceiling. `PERMITTED_ALLOCATION` is 100, and every
`PENDING_APPROVAL` or `PUBLISHED` INDIVIDUAL KPI of a person whose period
overlaps the new one counts against it. Drafts do not. Because the employee's
own KPIs are counted, their set comes first and an authority assigns into
what is left. A weight that does not fit is a 400 naming the remaining figure,
and at 100 the answer is that nothing is left. The check runs on create, on
submitting a draft, on an edit that moves weight or period, and on a weight
revision. `GET /kpis/allocation/:userId` returns the same figures for the form.

There is no database constraint on the total, in either direction.

## Changing a published target

`PATCH /kpis/:id` edits the definition while the KPI is not deleted. When a
published KPI's target or weight moves, the same transaction writes a
`kpi_revisions` row with the old and new values, so the original survives.
`POST /kpis/:id/revisions` still takes a revision with its own effective date
and reason for an authority who wants to record one explicitly.

Updates are appended, never edited. Scoring reads the newest row and the rest
stay as the history of how the number moved.

## KPI chat

`GET` and `POST /kpis/:id/chat` are a thread per KPI, stored in `kpi_messages`
with the same shape as `project_messages`, and the client renders it with the
project `MessagesPanel`. Reading and posting both run the KPI's own read check
first, so whoever cannot see the KPI cannot see or write its chat. A new
message notifies the KPI's owner and creator through `KPI_MESSAGE`, which the
notification gateway pushes in real time. A deleted KPI's thread is read only.

## View Score

`GET /kpis/scores` is the View Score tab for MD, EA, PA, HOD and Department
Controller. It reads `performance_scores`, the Action Tracker score table, and
calculates nothing. The caller's department scope is applied to the employee
before any filter, and every filter is ANDed onto it, so a department or user
outside scope comes back empty and `total` counts only what the caller may see.
Search covers full name, username and email; filters are department, user,
role, month and year; pagination is server side. No month or year means every
period, not a guessed one.

Each row has a KPIs button that opens the KPI breakdown for that person and
month from `GET /kpis/ps-score/:userId`. That route recomputes from live KPIs,
so after a month is finalized it can differ from the stored row; the breakdown
says it is the live score. A department outside the caller's scope is refused
with 403 and the message is shown in place of the table.

## Units

`kpi-units.ts` is a constant, not a table. The library is read-only reference
data, the chosen label and symbol are copied onto the KPI row, and a KPI already
running does not move when the list is edited.

Search returns direct matches first and then the rest of the groups those
matches came from, which is why typing "rupee" returns the dirham as well. A
department that needs something the library does not have types its own label
and it is stored the same way.

The ceiling: a custom unit is private to its KPI, not added to the library for
everybody. The upgrade path is a `kpi_units` table seeded from that array and
read in `searchUnits`, on the day somebody asks for a shared custom unit.

## The screens

`client/src/components/kpi/` has one page, `kpi-client.tsx`, with the detail
sheet opening over it. Most actions were built with the four-status workflow;
two were added afterwards because the endpoints existed with no screen:

| Endpoint | Where it is used |
| --- | --- |
| `POST /kpis/:id/revisions` | **Revise** on a published KPI (`kpi-revision-dialog.tsx`): new target and/or weight, effective date, reason. |
| `PUT /kpis/:id/contributions` | **Edit allocation** on a department or project KPI (`kpi-shares-dialog.tsx`); the whole set is replaced, an empty list clears it. |

Both buttons are drawn for whoever can Edit (the creator, or an authority) and
the server still decides; its refusal is shown in the dialog. Everything else
(own/others/score tabs, quick approve, chat, the allocation check in the form,
View Score) is described under its own heading above.

## Endpoints

See [API reference](p1_api_reference.md#kpis-and-ps-score).

## What this module does not do

These are the framework's own open items. None of them are guessed at here.

| Open item | What the code does instead |
| --- | --- |
| Policy for a missing actual | Excluded from the score, never a zero |
| Whether weights must total 100 | Reported, not enforced. `declared_weight` says what the set weighs |
| Whether overachievement is capped | Per KPI, through `cap_at`. Uncapped by default |
| Proration for someone joining mid-cycle | Nothing. The KPI is in scope if its period overlaps the month |
| Transition rules when an employee changes department | Nothing. The KPI keeps its `department_id` |
| Manual score override | Not built. The framework has not settled whether it is permitted at all |

Also absent, and absent on purpose: notifications on approval, a socket room per KPI chat,
evidence upload through the attachments module (`evidence_url` is a link), and
any combined AT + PS figure. The framework explicitly declines to define the
last of these.

The AT Score model in the client's version 2 document — the 50/30/20 split
across self actions, tasks and projects, and the HOD's four-part structure — is
not implemented either. It re-specifies the two scoring engines described in
[Scoring](p1_scoring.md), and most of its components rest on open decisions of
their own: the overdue penalty curve, the reduction for rework, which categories
need review at all. It is a separate piece of work from this one.
