# Leave management

Replaces WhatsApp and verbal leave requests with a single-stage approval
workflow that deducts from a tracked balance.

Build this first. It has the clearest rules, the highest daily usage, and no
dependency on any other Phase 2 module except the holiday calendar.

## Blockers to clear before writing code

**Who is HR?** `role_enum` has no `HR`. The scope document gives HR
cancellation authority and common-holiday ownership. Either add `HR` to the
enum or designate an existing role. This is the first question to ask the
client.

**What are the policies?** You need, per leave type: annual entitlement,
whether it is paid, whether it carries forward and by how much, whether proof
is required, and whether the year is calendar or financial. Without these,
`leave_balances` cannot be seeded and the balance check has nothing to check
against.

**Half days?** The schema uses `Decimal(5,1)` for day counts so half days
work. Confirm whether the client wants them in the UI.

## Tables

`leave_types`, `leave_balances`, `leave_applications`, `holidays`, and the
`leave_status_enum`. Full definitions in
[Schema changes](p2_data_model.md#leave).

Also needed on `users`: `reporting_to_id` for approval routing, and
`joined_on` if entitlement is prorated for mid-year joiners.

## The workflow

Single-stage approval. Either the HOD or HR can approve — whichever acts
first closes it. There is no second, mandatory HR sign-off stage.

```
Employee submits
        |
        v
    PENDING  --reject (HOD or HR)-->  REJECTED
        |
   approve (HOD or HR, first to act wins)
        |
        v
    APPROVED  (balance deducted, calendar updated)
        |
   HR cancels, with reason
        |
        v
    CANCELLED  (balance credited back)

Employee may cancel from PENDING  -->  CANCELLED (no credit needed, nothing was deducted)
```

Use an `updateMany` with `status: 'PENDING'` in the `where` clause for both
the HOD and the HR approve endpoints, so whichever request lands first wins
and the second gets a 409 rather than a double approval.

**Cancelling an already-approved leave is HR-only.** The scope document
requires a reason on cancellation and a credit of the deducted balance. Both
are mandatory: no reason, no cancellation; the credit is not optional or
client-configurable.

## Validation on submission

Run all of these before writing the row, and return every failure at once
rather than one at a time. Employees fill this form on a phone and a
one-error-at-a-time loop is miserable.

1. `end_date` is not before `start_date`.
2. The date range does not overlap an existing application for this user that
   is `PENDING` or `APPROVED`.
3. The range does not fall entirely on holidays or weekly offs. Partial
   overlap is fine; those days are excluded from `days_count`. Holiday lookup
   must apply both the applicant's department-wise holidays and the
   company-wide common holidays — see below.
4. `days_count`, after excluding holidays and weekly offs, is at least 0.5.
5. The user's balance for this leave type and year is at least `days_count`,
   unless the type is unpaid.
6. Any leave type with `requires_proof` has an attachment.

Rule 3 is the one that needs the holiday calendar, which is why holidays has
to land before or with this module. If holidays slips, ship with rule 3
disabled and a `TODO` rather than blocking the whole module.

Weekly offs are not modelled anywhere. Simplest approach: a company-wide
constant for which weekdays are non-working, read from configuration. Do not
build a per-employee shift calendar; that is the attendance module's job and
it is an optional add-on.

## Balance deduction

Deduct on approval, whichever role approves. Do it inside the same
transaction that sets `status: APPROVED`:

```ts
await this.prisma.$transaction(async (tx) => {
  const updated = await tx.leave_applications.updateMany({
    where: { id, status: 'PENDING' },
    data: {
      status: 'APPROVED',
      approved_by_id: user.sub,
      approved_by_role: user.role,   // 'HOD' or 'HR'
      approved_at: new Date(),
      approval_remark: remark,
    },
  });
  if (updated.count === 0) {
    throw new ConflictException('Application is no longer pending approval');
  }

  await tx.leave_balances.update({
    where: { user_id_leave_type_id_year: { user_id, leave_type_id, year } },
    data: { used: { increment: days_count } },
  });
});
```

The `updateMany` with the status in the `where` clause is what stops both a
HOD and HR approving the same application and deducting twice. `increment` on
the balance means Postgres does the arithmetic, so a concurrent deduction on
another application for the same user cannot lose an update.

Rejection does not touch the balance.

HR cancellation of an `APPROVED` application is the mirror transaction, and it
needs the same guard for the same reason. Write it out rather than leaving it
as "the mirror of the above," because the obvious implementation is a plain
`update` and that one double-credits silently. Nobody reports a balance that
came out too generous.

```ts
await this.prisma.$transaction(async (tx) => {
  const updated = await tx.leave_applications.updateMany({
    where: { id, status: 'APPROVED' },
    data: {
      status: 'CANCELLED',
      cancelled_by_id: user.sub,
      cancelled_at: new Date(),
      cancellation_reason: reason,   // required, reject the request without it
    },
  });
  if (updated.count === 0) {
    throw new ConflictException('Application is not in an approved state');
  }

  await tx.leave_balances.update({
    where: { user_id_leave_type_id_year: { ... } },
    data: { used: { decrement: days_count } },
  });
});
```

## Approval routing

Either role can act, in any order:

**HOD stage.** `leave_applications.manager_id` is set at submission from
`users.reporting_to_id`. If that is null, fall back to the HODs of the
applicant's department via `hod_departments`. If neither resolves, the
application still gets created but flags for HR attention; do not silently
drop it.

**HR stage.** Any user in the HR role can act on any pending application,
company-wide, regardless of the applicant's department or reporting line.

**Nobody approves their own leave.** This mattered less under the old two-stage
design, where a self-approval still had to clear a second desk. With one stage
and company-wide HR authority, an HR employee approving their own application
is a single click and nothing stops it. So: `approved_by_id != user_id`,
enforced in the service, not the UI. An approver's own application routes to
the MD, who is otherwise not in this chain.

That is the only case where the MD acts on leave. If the client also wants MD
approval for long leave generally, that is a separate stage and a rule about
which durations trigger it. Not currently in scope.

## Holiday calendar

**Two tiers.** Common holidays apply company-wide. Department-wise holidays
apply only to that department. A user's effective calendar for a year is the
union of common holidays and their department's holidays.

**Who sets what.** HR sets common holidays. Department-wise holidays can be
set by either the HOD of that department or HR — either one, not both
required. There is no separate approval step for a department holiday.

**Defaults.** Seed the default government/company calendar as common
holidays on setup so the module is usable on day one. HR and HODs edit from
the dashboard afterward; nothing here blocks editing a preloaded row.

`holidays.department_id` is nullable: null means common, set means
department-wise. See [Schema changes](p2_data_model.md#leave).

## Endpoints

Employee:

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/leave/applications` | submit, runs all validation |
| GET | `/leave/applications/mine` | own history with status |
| GET | `/leave/applications/:id` | detail, own only |
| PATCH | `/leave/applications/:id/cancel` | own, `PENDING` only |
| GET | `/leave/balance` | own balance for the current year, all types |

Approvers:

| Method | Path | Roles |
| --- | --- | --- |
| GET | `/leave/applications/pending` | HOD, HR, MD |
| PATCH | `/leave/applications/:id/approve` | HOD, HR |
| PATCH | `/leave/applications/:id/reject` | HOD, HR |
| PATCH | `/leave/applications/:id/hr-cancel` | HR only, requires `cancellation_reason`, `APPROVED` only |
| GET | `/leave/calendar` | HOD, HR, MD, and self for own team |

HR administration:

| Method | Path | Roles |
| --- | --- | --- |
| GET | `/leave/types` | all authenticated |
| POST | `/leave/types` | HR, ADMIN |
| PATCH | `/leave/types/:id` | HR, ADMIN |
| GET | `/leave/balances` | HR |
| PATCH | `/leave/balances/:id` | HR, manual correction |
| GET | `/leave/reports/monthly` | HR, MD |
| GET | `/leave/reports/export` | HR, MD |

Holidays:

| Method | Path | Roles |
| --- | --- | --- |
| GET | `/holidays` | all authenticated, effective calendar for the caller's department |
| GET | `/holidays/upcoming` | all authenticated, feeds the dashboard banner |
| POST | `/holidays` | HR (any), HOD (own department only), ADMIN |
| PATCH | `/holidays/:id` | HR (any), HOD (own department only), ADMIN |
| DELETE | `/holidays/:id` | HR (any), HOD (own department only), ADMIN |

A single `/approve` and `/reject` endpoint, not separate `manager-approve`
and `hr-approve` ones. Both roles run the same transition against the same
`PENDING` status, so a role branch inside one handler is simpler than two
handlers that would otherwise be identical. `hr-cancel` stays a separate
endpoint because it is a different transition (`APPROVED` → `CANCELLED`),
touches the balance in the opposite direction, and is HR-only.

## Screens

**Apply for leave.** Type selector, date range, reason, optional attachment.
Show the remaining balance for the selected type as soon as the type is
picked, and show the computed working days as soon as the dates are picked,
with holidays visibly excluded. Employees will not trust the balance if they
cannot see the arithmetic.

**My leave.** Table of applications with status chips, remaining balances per
type across the top, and a link into each application's detail.

**Pending approvals.** For HODs and HR. Each row shows the applicant, dates,
type, reason, and the applicant's remaining balance for that type. Approve
and reject inline with a remark field. Reject requires the remark. No "waiting
on the other approver" state — either role closes it outright.

**HR cancellation.** Reachable only from an `APPROVED` application, HR view
only. Requires a reason field before the cancel button enables. Confirms the
balance credit in the same dialog so HR is not surprised by it after the
fact.

**Team calendar.** Month grid showing who is on leave when, filtered to the
viewer's scope. A HOD should be able to open this from the approval screen
before deciding, which is the whole point of it.

**Holiday calendar.** Read-only list for employees, grouped by common and
department-wise. Editable for HR (both tiers) and HODs (their own
department's tier only).

## Notifications

Every status change notifies. New `notification_type_enum` values:

```
LEAVE_SUBMITTED    to the HOD and HR
LEAVE_APPROVED     to the applicant, and to whichever of HOD/HR did not act
LEAVE_REJECTED     to the applicant
LEAVE_HR_CANCELLED to the applicant, and to the approver who originally approved it
LEAVE_CANCELLED    to the HOD and HR (both were notified at submission)
```

Rejections and HR cancellations must carry the approver's remark or
cancellation reason in the notification body. An employee who gets "your
leave was rejected" or "your leave was cancelled" with no reason will ask in
person, which defeats the purpose of the module.

Go through the notification engine interface, not a direct
`createNotification()` call, so that email and any future WhatsApp channel
come for free. See [Notification engine](p2_notifications.md).

## Reports

HR needs a monthly export for payroll reconciliation. One row per employee
per leave type with days taken, days remaining, and unpaid days. `exceljs` is
already a dependency on the server and is used by the VMS reports module;
copy that pattern rather than adding a new library.

## Year rollover

Balances are per year. Something has to create next year's rows and carry
over what the leave type allows. Options:

A cron on 1 January that creates `leave_balances` rows for every active user
for every active leave type, seeding `carried_over` from the previous year
capped at `max_carry_forward`.

Or lazy creation: when a balance is read or deducted for a year that has no
row, create it then.

Lazy creation is less code and has no scheduled job to fail silently at
midnight on New Year's Day. It does mean the balance screen creates rows as a
side effect of a read, which is unusual but acceptable here. Pick one and
write it down; the failure mode of having neither is that leave stops
working in January.
