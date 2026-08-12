# Leave management

Replaces WhatsApp and verbal leave requests with a two-stage approval workflow
that deducts from a tracked balance.

Build this first. It has the clearest rules, the highest daily usage, and no
dependency on any other Phase 2 module except the holiday calendar.

## Blockers to clear before writing code

**Who approves at the HR stage?** `role_enum` has no `HR`. The scope document
describes HR as final approver, balance deductor, and report generator. Either
add `HR` to the enum or designate an existing role. This is the first question
to ask the client.

**What are the policies?** You need, per leave type: annual entitlement, whether
it is paid, whether it carries forward and by how much, whether proof is
required, and whether the year is calendar or financial. Without these,
`leave_balances` cannot be seeded and the balance check has nothing to check
against.

**Half days?** The schema uses `Decimal(5,1)` for day counts so half days work.
Confirm whether the client wants them in the UI.

## Tables

`leave_types`, `leave_balances`, `leave_applications`, `holidays`, and the
`leave_status_enum`. Full definitions in
[Schema changes](p2_data_model.md#leave).

Also needed on `users`: `reporting_to_id` for approval routing, and `joined_on`
if entitlement is prorated for mid-year joiners.

## The workflow

```
Employee submits
        |
        v
PENDING_MANAGER  --reject-->  REJECTED
        |
     approve
        |
        v
PENDING_HR       --reject-->  REJECTED
        |
     approve
        |
        v
APPROVED  (balance deducted, calendar updated)

Employee may cancel from PENDING_MANAGER or PENDING_HR  -->  CANCELLED
```

Cancelling an already `APPROVED` leave is a separate question. If the client
wants it, it needs a balance credit and its own audit entry. Default: not in
scope, an approved leave is changed by HR editing it, not by the employee
cancelling it.

## Validation on submission

Run all of these before writing the row, and return every failure at once rather
than one at a time. Employees fill this form on a phone and a one-error-at-a-time
loop is miserable.

1. `end_date` is not before `start_date`.
2. The date range does not overlap an existing application for this user that is
   `PENDING_MANAGER`, `PENDING_HR`, or `APPROVED`.
3. The range does not fall entirely on holidays or weekly offs. Partial overlap
   is fine; those days are excluded from `days_count`.
4. `days_count`, after excluding holidays and weekly offs, is at least 0.5.
5. The user's balance for this leave type and year is at least `days_count`,
   unless the type is unpaid.
6. Any leave type with `requires_proof` has an attachment.

Rule 3 is the one that needs the holiday calendar, which is why holidays has to
land before or with this module. If holidays slips, ship with rule 3 disabled
and a `TODO` rather than blocking the whole module.

Weekly offs are not modelled anywhere. Simplest approach: a company-wide
constant for which weekdays are non-working, read from configuration. Do not
build a per-employee shift calendar; that is the attendance module's job and it
is an optional add-on.

## Balance deduction

Deduct on HR approval, not on submission, and not on manager approval.

Do it inside the same transaction that sets `status: APPROVED`, and use the same
idempotency pattern the requests module uses:

```ts
await this.prisma.$transaction(async (tx) => {
  const updated = await tx.leave_applications.updateMany({
    where: { id, status: 'PENDING_HR' },
    data: { status: 'APPROVED', hr_id: user.sub, hr_acted_at: new Date(), hr_remark },
  });
  if (updated.count === 0) {
    throw new ConflictException('Application is no longer pending HR approval');
  }

  await tx.leave_balances.update({
    where: { user_id_leave_type_id_year: { user_id, leave_type_id, year } },
    data: { used: { increment: days_count } },
  });
});
```

The `updateMany` with the status in the `where` clause is what stops two HR
users approving the same application and deducting twice. `increment` on the
balance means Postgres does the arithmetic, so a concurrent deduction on another
application for the same user cannot lose an update.

Rejection at either stage does not touch the balance.

## Approval routing

Manager stage: `leave_applications.manager_id` is set at submission from
`users.reporting_to_id`. If that is null, fall back to the HODs of the
applicant's department via `hod_departments`. If neither resolves, the
application still gets created but flags for HR attention; do not silently drop
it.

HR stage: assign to whichever role the client designates. Any user in that role
can act.

The MD is not in this chain. If the client wants MD approval for long leave, that
is a third stage and a rule about which durations trigger it. Not currently in
scope.

## Endpoints

Employee:

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/leave/applications` | submit, runs all validation |
| GET | `/leave/applications/mine` | own history with status |
| GET | `/leave/applications/:id` | detail, own only |
| PATCH | `/leave/applications/:id/cancel` | own, pending states only |
| GET | `/leave/balance` | own balance for the current year, all types |

Approvers:

| Method | Path | Roles |
| --- | --- | --- |
| GET | `/leave/applications/pending` | HOD, HR, MD |
| PATCH | `/leave/applications/:id/manager-approve` | HOD, EA, PA, DEPT_CONTROLLER |
| PATCH | `/leave/applications/:id/manager-reject` | same |
| PATCH | `/leave/applications/:id/hr-approve` | HR |
| PATCH | `/leave/applications/:id/hr-reject` | HR |
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
| GET | `/holidays` | all authenticated |
| GET | `/holidays/upcoming` | all authenticated, feeds the dashboard banner |
| POST | `/holidays` | HR, ADMIN |
| PATCH | `/holidays/:id` | HR, ADMIN |
| DELETE | `/holidays/:id` | HR, ADMIN |

Separate `manager-approve` and `hr-approve` endpoints rather than one
`/approve` that branches on the caller's role. The role lists differ, the
columns written differ, and only one of them touches the balance. Two endpoints
is less code than one endpoint with a branch, and the `@Roles` decorator does
the authorisation for free.

## Screens

**Apply for leave.** Type selector, date range, reason, optional attachment.
Show the remaining balance for the selected type as soon as the type is picked,
and show the computed working days as soon as the dates are picked, with
holidays visibly excluded. Employees will not trust the balance if they cannot
see the arithmetic.

**My leave.** Table of applications with status chips, remaining balances per
type across the top, and a link into each application's detail.

**Pending approvals.** For managers and HR. Each row shows the applicant, dates,
type, reason, and the applicant's remaining balance for that type. Approve and
reject inline with a remark field. Reject requires the remark.

**Team calendar.** Month grid showing who is on leave when, filtered to the
viewer's scope. A manager should be able to open this from the approval screen
before deciding, which is the whole point of it.

**Holiday calendar.** Read-only list for employees, editable for HR.

## Notifications

Every status change notifies. New `notification_type_enum` values:

```
LEAVE_SUBMITTED       to the manager
LEAVE_MANAGER_APPROVED to the applicant and to HR
LEAVE_MANAGER_REJECTED to the applicant
LEAVE_HR_APPROVED     to the applicant
LEAVE_HR_REJECTED     to the applicant
LEAVE_CANCELLED       to the manager and HR if it had reached them
```

Rejections must carry the approver's remark in the notification body. An
employee who gets "your leave was rejected" with no reason will ask in person,
which defeats the purpose of the module.

Go through the notification engine interface, not a direct
`createNotification()` call, so that email and any future WhatsApp channel come
for free. See [Notification engine](p2_notifications.md).

## Reports

HR needs a monthly export for payroll reconciliation. One row per employee per
leave type with days taken, days remaining, and unpaid days. `exceljs` is
already a dependency on the server and is used by the VMS reports module; copy
that pattern rather than adding a new library.

## Year rollover

Balances are per year. Something has to create next year's rows and carry over
what the leave type allows. Options:

A cron on 1 January that creates `leave_balances` rows for every active user for
every active leave type, seeding `carried_over` from the previous year capped at
`max_carry_forward`.

Or lazy creation: when a balance is read or deducted for a year that has no row,
create it then.

Lazy creation is less code and has no scheduled job to fail silently at midnight
on New Year's Day. It does mean the balance screen creates rows as a side effect
of a read, which is unusual but acceptable here. Pick one and write it down; the
failure mode of having neither is that leave stops working in January.
