# Phase 2 plan and sequencing

Phase 2 turns PerformX from a task and performance tool into the company's
internal operations suite. Seven modules, one month, ₹1,10,000, with modules
released as they finish rather than all at the end.

This page is the map. Each module has its own page with tables, endpoints, and
screens.

## Scope

| Module | Where the work lands | Page |
| --- | --- | --- |
| Leave application | PerformX | [Leave management](p2_leave.md) |
| Projects | PerformX | [Projects](p2_projects.md) |
| Event management (low priority) | PerformX | [Projects](p2_projects.md#event-management) |
| Innovation and R&D | PerformX | [R&D and company assets](p2_rnd_and_assets.md) |
| Passwords and documents | PerformX | [R&D and company assets](p2_rnd_and_assets.md#company-assets) |
| Birthdays, holidays, polls, analytics | PerformX | [Home dashboard](p2_dashboard_social.md) |
| Vendor management | PerformX | [Vendor management](p2_vendors.md) |
| CSR foundation | PerformX | [CSR foundation](p2_csr.md) |
| Notification engine | PerformX | [Notification engine rebuild](p2_notifications.md) |
| Career portal embedding | Both repos | [CareerX and VMS integration](p2_integration.md) |
| Visitor notifications on employee dashboards | PerformX | [CareerX and VMS integration](p2_integration.md#visitor-management) |

Optional add-ons with no WideAngle development cost: an attendance module
(clock in and out, feeding the leave module) and a WhatsApp channel on the
notification engine. Third party licensing for the WhatsApp Business API is
billed separately by that provider. Neither is committed; build them only if
the client asks and the notification engine is already done.

## Week by week

The client-facing timeline is four weeks. This is the engineering ordering that
makes it achievable, which is not quite the same as the order the modules are
listed in.

**Week 0, before feature work starts.** Two days, and they are not optional.

1. Set up Prisma migrations. Baseline the current schema, verify a migration
   applies cleanly to a copy of production, and stop using `db push`. Phase 2
   adds fifteen tables to a live database. See
   [Known gaps](p1_known_gaps.md#no-database-migrations).
2. Wire `EscalationModule` into `AppModule` and run the sweep against a
   production copy to count what it would send. The notification engine rebuild
   depends on escalation actually working.

**Week 1, HR core.** Leave applications end to end, plus the foundation of the
projects module. Leave first because it is the module with the clearest rules,
the highest daily usage, and no dependencies on anything else in the phase.

**Week 2, collaboration and the dashboard.** Project checklists, project
messaging, outcome logging, and closure reports. Then the home dashboard layer:
birthdays, holidays, polls, and the company analytics views.

Holidays has a hard ordering constraint: the leave module's overlap validation
reads the holiday calendar, so if holidays slip past leave, leave ships with a
disabled validation rule and needs a second pass.

**Week 3, vendors, CSR, R&D.** These three are the most self-contained work in
the phase. Vendors is the riskiest of them because it introduces an external
user type and therefore a new trust boundary. Do vendors first in the week, not
last.

**Week 4, integration and rollout.** The notification engine across every new
module, CareerX embedded as a tab, VMS check-in notifications on employee
dashboards, testing, and rollout.

The notification engine is listed last but it should be designed in Week 1.
Every module built in weeks 1 to 3 has to emit notifications, and if the engine
does not exist yet, each module invents its own call and Week 4 becomes a
rewrite rather than an integration. Build the engine's interface early, let
modules code against it, and fill in the delivery channels in Week 4.

## Dependency order

Things that must be true before other things can start:

```
migrations            -> everything
holidays calendar     -> leave overlap validation
notification contract -> every module that notifies
projects              -> R&D (R&D is a supervised subset of projects)
vendor user type      -> vendor task assignment
CareerX SSO fixed     -> career tab embedding
```

R&D is described in the scope document as "a supervised, simplified version of
the Projects module." Build it as a variant of projects, not as a parallel
implementation. See [R&D and company assets](p2_rnd_and_assets.md).

## Decisions already made

These are settled. You do not need to reopen them.

**Vendors are a role, not a separate app.** A new `VENDOR` value in `role_enum`,
with visibility restricted to explicitly assigned work. Not a separate deploy,
not a separate database.

**The career portal stays a separate deployment.** Phase 2 embeds it as a tab
inside the PerformX shell. It does not get merged into the PerformX codebase.
The scope document is explicit that career portal work is "limited to embedding
it as a tab within PerformX and aligning its data with the HR module, not
rebuilding it."

**Polls are not anonymous.** The name of the person who raised a poll is always
shown.

**Asset visibility is self-scoped.** An employee sees only their own entries.
EA, PA, and MD see everything. HR sees everything for one employee when viewing
that employee's profile.

**Project closure is mandatory.** A project cannot be marked closed without a
final outcome report, and that report auto-forwards to the MD.

## Open questions to settle before Week 1

Ask these now, not in Week 3.

**Who is HR?** The scope document describes an HR dashboard as a distinct role
with final leave approval and access to employee documents during offboarding.
`role_enum` has no `HR` value. Either add one or designate an existing role.
This decision blocks the leave module's approval chain, so it is the first thing
to resolve.

**What are the leave policies?** Leave types are named (casual, sick, earned,
unpaid, comp-off) but the accrual rules, annual entitlements, carry-forward
rules, and whether balances reset on a calendar or financial year are not
specified. Leave balance cannot be built without them.

**Does the scoring model change?** Projects log tries, failures, and outcomes.
The scope document does not say whether any of that feeds performance scores.
If it does, that is a change to an engine that already disagrees with its own
specification. Default assumption: it does not, and projects are tracked but
not scored.

**Is incentives in or out?** The Phase 1 spec lists incentives as an in-scope
module. It was never built. The Phase 2 scope document does not mention it. See
[Known gaps](p1_known_gaps.md#no-incentives-module).

## Budget allocation

From the scope document, for reference when trading scope against time:

| Area | Allocation |
| --- | --- |
| HR facilities: leave, projects, events, R&D, passwords and documents | ₹35,000 |
| Dashboard and analytics: birthdays, holidays, scoring, polls | ₹18,000 |
| Vendor management | ₹15,000 |
| CSR foundation tab | ₹8,000 |
| Notification engine | ₹14,000 |
| Career portal and visitor management integration | ₹10,000 |
| Testing, QA, rollout | ₹10,000 |

Event management is explicitly marked low priority in the scope document. If the
month runs short, it is the first thing to cut, and cutting it does not break
anything else.

## Delivery risks

**Migrations.** Covered above. This is the one that can lose data.

**Fifteen new tables in one month on a schema with no test coverage.** Every
new foreign key to `users` adds a relation field to a model that already has
forty. Prisma client generation gets slower and the risk of a bad relation name
goes up.

**The notification engine touching every module.** If it is built last it
becomes a rewrite. Design the interface first.

**The vendor trust boundary.** Vendors are external. Every query in a module a
vendor can reach needs an explicit scope check, and `RolesGuard` will not do it
for you. Read [Auth and roles](p1_auth_and_roles.md#how-authorization-is-enforced)
before writing the first vendor endpoint.

**One month for seven modules.** The scope document commits to staged releases
rather than a single delivery at the end. Hold to that. Shipping leave in Week 1
and getting real usage feedback is worth more than shipping everything untested
in Week 4.
