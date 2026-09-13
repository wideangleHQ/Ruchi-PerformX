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
  kpi-lifecycle.ts    the ten states and who may move between them
  kpi-scoring.spec.ts the framework's worked examples as tests
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

- A **cancelled** KPI has its weight redistributed rather than zeroed, so a KPI
  dropped for legitimate business reasons cannot fail anybody.
- A KPI with **no update yet** drops out on the same path, so a missing actual
  is not silently a zero. The framework marks that an open business decision;
  the code takes the safe direction and the decision, when it arrives, is a
  change to one function.
- A set whose weights **do not total 100** still produces a number out of 100,
  and the shortfall is reported as `declared_weight` so the UI can say so.

The score is computed on read. There is no cron and no `ps_scores` table: the
KPI rows and their update history are the source, a locked KPI preserves its
target and actual permanently, and nothing has asked for cross-cycle
benchmarking yet.

## Lifecycle

```
Draft → Pending Approval → Approved → Active → In Progress →
Pending Review → Evaluated → Finalized → Locked
```

Cancelled is reachable from every state except Locked. Nothing leaves Locked.

Every move goes through one endpoint, `PATCH /kpis/:id/status`, with the legal
moves and the roles allowed to make them in `TRANSITIONS` in
`kpi-lifecycle.ts`. Adding a state is a row in that table rather than a route, a
DTO and a service method.

Two moves happen without the endpoint: entering the first actual, or ticking the
first milestone, moves an `ACTIVE` KPI to `IN_PROGRESS`, because that is what In
Progress means and nobody should have to remember to say so.

An HOD creates and submits; the MD office and the Department Controller approve,
finalize, lock and cancel. An HOD does not approve the target they set
themselves.

## Changing an approved target

`PATCH /kpis/:id` is refused once a KPI leaves `DRAFT`. After that a target or
weight change goes through `POST /kpis/:id/revisions`, which writes the old
value and the new one onto a `kpi_revisions` row with an effective date, a
reason and an author, then applies the new value to the KPI. Both remain
visible. Nothing overwrites a target silently.

Updates are appended, never edited. Scoring reads the newest row and the rest
stay as the history of how the number moved.

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

Also absent, and absent on purpose: notifications on approval, socket events,
evidence upload through the attachments module (`evidence_url` is a link), and
any combined AT + PS figure. The framework explicitly declines to define the
last of these.

The AT Score model in the client's version 2 document — the 50/30/20 split
across self actions, tasks and projects, and the HOD's four-part structure — is
not implemented either. It re-specifies the two scoring engines described in
[Scoring](p1_scoring.md), and most of its components rest on open decisions of
their own: the overdue penalty curve, the reduction for rework, which categories
need review at all. It is a separate piece of work from this one.
