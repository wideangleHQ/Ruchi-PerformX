# Decision log

Newest at the bottom. An entry goes in the same commit as the change it
describes.

Write one whenever you pick between two reasonable options: schema shape, role
rules, notification or socket behaviour, a new dependency, a pattern other
modules will copy, or anything a future reader would otherwise have to reverse
engineer from a diff. Skip it for renames, typo fixes, and anything the diff
explains on its own.

The shape:

```markdown
## YYYY-MM-DD Short title

**Decision.** One sentence, present tense.
**Why.** The constraint that forced it.
**Instead of.** What was rejected, and what was wrong with it.
**Costs.** What this makes harder later, or "none known".
```

Nothing is deleted from this file. A decision that turns out wrong gets a new
entry that supersedes the old one by date and says so.

The Phase 1 decisions that predate this log are described in their chapters:
roles and department scoping in [Auth and roles](p1_auth_and_roles.md), the
three audit mechanisms and the missing migrations in
[Known gaps](p1_known_gaps.md).

---

## 2026-08-16 Decisions live in the handbook, not in a separate file

**Decision.** The decision log is a handbook chapter, so it builds, searches,
and gets read alongside everything else.
**Why.** A `DECISIONS.md` at the repository root would be a second place to keep
current, and the handbook is already the thing people are told to read first.
**Instead of.** A root file, which drifts, or one file per decision, which is
process for a repository with a single active developer.
**Costs.** Every entry needs `just docs-build` to pass, so a malformed entry
breaks the docs build rather than sitting there quietly.

## 2026-08-16 The assistant enforces permissions in Postgres, not in the prompt

**Decision.** Model-generated SQL runs as a dedicated read-only role inside a
transaction that stamps the caller, and row-level security policies filter the
rows. The permission rules are never stated to the model as instructions it is
expected to follow.
**Why.** A HOD is on the requested user list, and every other part of the
product scopes a HOD to their own department. An assistant that got this wrong
would hand out data the API refuses, through a friendlier interface.
**Instead of.** Putting the rules in the system prompt, which fails to prompt
injection, fails silently, and cannot be tested exhaustively.
**Costs.** RLS policies are new infrastructure on a live database with no test
coverage, written per table and tested against a restored production copy. It is
the largest engineering item in that project and it cannot start before
migrations exist. See [The PerformX Assistant](p2_assistant.md).

## 2026-08-16 The assistant runs on a hosted model, starting with Claude Haiku 4.5

**Decision.** Hosted API, Haiku 4.5 first, moving up only if tier 2 SQL quality
measurably needs it.
**Why.** At roughly 1,100 questions a month the whole company costs about ₹350
with prompt caching. Inference cost is not a real variable, so the choice is
made on tool-selection accuracy and latency instead.
**Instead of.** Self-hosting, which is about 130 times more expensive at this
volume and breaks even somewhere north of 97,000 questions a month. And Chinese
hosted APIs, which save around ₹700 a month while putting employee records in a
jurisdiction RUCHI has no recourse in, with RUCHI as the data fiduciary under
the DPDP Act.
**Costs.** Employee data reaches a third party, so this needs client sign-off.
If residency turns out to be a hard requirement, the cheaper answers are a
regional endpoint, a zero-retention agreement, and tokenising identifiers before
they are sent, in that order. Self-hosted Qwen or DeepSeek runs the same
architecture unchanged.

## 2026-08-16 Deploys are scheduled, and production is deployed by hand

**Decision.** `ci.yaml` no longer deploys on push. It builds a preview on a
daily cron and on demand, and it does not build production at all. Production
goes out from Vercel when somebody decides the code is ready.
**Why.** Phase 2 lands as roughly seventeen merges into `main`. Deploying each
one put half-finished modules in front of about a hundred employees, and a
Vercel rollback does not undo the migration that shipped with it. Keeping
production out of the workflow means no configuration change can make it
automatic by accident.
**Instead of.** A `--prod` target on a `workflow_dispatch` dropdown, which was
written and rejected: it is one wrong click from a production deploy and it
implies the repository owns a release process that a person actually owns.
Also rejected: deploy on push behind a feature flag per module, which is more
moving parts than a company this size needs.
**Costs.** The deployed site and `main` drift by up to a day, so "it works on
the preview" is a statement about yesterday. Production releases leave no trace
in this repository, so "what is live right now" is answered in the Vercel
dashboard and nowhere else. GitHub also disables scheduled workflows after
sixty days without a push, which stops the daily preview silently.

## 2026-08-16 The migration baseline is taken from the database, not the schema

**Decision.** `0_init` is a dump of production as it actually was, generated
with `migrate diff --from-empty --to-config-datasource`. It is marked applied on
production and never executed there. Two real migrations follow it: the
twenty-four indexes the database never received, and the two dead columns.
**Why.** The baseline procedure written in `p2_data_model.md` generated `0_init`
from `schema.prisma` instead. That records "the database matches the schema" as
a fact, and it was not one: production was missing every index from
`20260703184500_add_performance_indexes` and carried two columns the schema no
longer declares. Baselining from the schema would have buried both, and the
first Phase 2 `migrate dev` would then have produced a migration that quietly
dropped two columns alongside whatever feature was being built.
**Instead of.** Marking the ten existing directories applied one by one, which
records the un-applied index migration as done and loses those indexes for good.
And `--from-empty --to-schema-datamodel` as originally written, above.
**Costs.** `0_init` is 918 lines of generated SQL that nobody will read. It is
also never run against production, so a mistake in it only surfaces when
somebody builds a database from scratch, which `just migrate-verify` is for.
The ten old directories are deleted; their history is in git.

## 2026-08-16 The Prisma CLI connects on 5432, the API on 6543

**Decision.** `server/prisma.config.ts` sets the CLI datasource to `DIRECT_URL`.
`DATABASE_URL` stays the pooler and stays what the API uses.
**Why.** Supabase's transaction pooler cannot hold the session-level advisory
lock `prisma migrate` takes. Every migrate command against it hangs until it is
killed, with no error explaining why, which is how this went unnoticed long
enough for the schema to drift from its own migrations.
**Instead of.** Leaving the config on `DATABASE_URL` and asking everyone to
remember an environment override. That is the same shape as the mistake that
caused a `migrate deploy` to reach production during this work: an override that
looked right and was inert.
**Costs.** `DIRECT_URL` becomes required for any CLI work and is now in
`server_env_required`. The two URLs being different is a thing to know, and the
comment in `prisma.config.ts` is the only place it is explained in code.

## 2026-08-16 Phase 2 tables carry no Prisma relations

**Decision.** Every Phase 2 table uses plain FK columns. No `@relation` fields,
no back-relations on `users`. Services resolve display names through
`common/helpers/user-lookup.helper.ts`.
**Why.** `users` already holds forty relation fields. A back-relation per Phase
2 table would put thirty-odd modules' migrations in one model, slow client
generation, and make `users` a file every feature branch edits and conflicts
over. This is also how `p2_data_model.md` writes the models.
**Instead of.** Full relations, which buy `include` at the cost of that
conflict surface; or ad-hoc lookups per service, which is the same query
written thirty times with thirty chances to make it an N+1.
**Costs.** No nested writes and no `include` on Phase 2 tables. A list endpoint
needing names calls `attachUsers` explicitly, and forgetting to is a missing
name in the UI rather than a crash. Add `@relation` per table if a module ever
needs a nested write; nothing in Phase 2 does.

## 2026-08-16 The Phase 2 spine lands before the feature work

**Decision.** One commit carries the whole Phase 2 schema, the notification
engine, all module registrations in `app.module.ts`, and the sidebar entries.
Feature branches then touch only their own module directory.
**Why.** `schema.prisma`, `app.module.ts` and `Sidebar.tsx` are the three files
every Phase 2 module would otherwise edit. Sixteen branches editing them is a
sixteen-way conflict in the one file where a bad merge silently drops a Prisma
model and nothing fails until runtime.
**Instead of.** A branch per module carrying its own slice of the schema, which
is the arrangement that produces those conflicts. Or one giant branch, which
nobody can review.
**Costs.** The schema contains tables no code reads yet, which reads as
speculative until the modules land. Module stubs are registered and expose no
routes, so `just routes` lists them empty until their controller arrives.

## 2026-08-16 RolesGuard denies external roles when a handler has no @Roles

**Decision.** A handler carrying no `@Roles` is now unreachable by
`role_enum.VENDOR`. Opening a route to a vendor requires listing `VENDOR`
explicitly, which only happens in `modules/vendor-portal/`.
**Why.** `RolesGuard` returned true whenever no role list was present, which
read as "any authenticated user" and was a safe default for exactly as long as
every token holder was an employee. Seventeen controllers carry no `@Roles` at
all, including `profile`, `dashboard`, `comments`, `notifications` and
`attachments`. None was written with an outside reader in mind, and Phase 2 adds
an external login on the same token and the same guard.
**Instead of.** Adding `@Roles` to every one of those seventeen controllers and
to each of the roughly 121 Phase 2 endpoints, then relying on nobody forgetting.
That is the same guarantee spread across a hundred places instead of one, and
the failure mode of forgetting is silent.
**Costs.** A future non-employee role has to be added to `EXTERNAL_ROLES` or it
inherits the old open default. The `@Public()` path is unchanged, since those
requests carry no user and never reached a role check.

## 2026-08-16 Socket rooms are not authorised on join

**Decision.** Recorded, not fixed. `task:join` and `project:join` accept any
valid token and admit the caller to that room.
**Why not fixed here.** The fix is a membership lookup inside the gateway's join
handlers, which means giving the gateway a Prisma dependency while several
project branches are open against that file. It is a contained change and it
should be its own commit.
**What it means meanwhile.** The REST rule on `GET /projects/:id/messages` is
members-only, and the socket room is wider than that. A vendor login holding a
valid token can join `project:<id>` and receive `project:message:new`. Until the
join handlers check membership, do not treat the socket as a permission
boundary. See `docs/src/p1_notifications.md`.
## 2026-08-16 Project leadership is a column, membership is a table

**Decision.** `projects.lead_id` and `projects.co_lead_id` are the source of
truth for who leads a project. `POST /projects/:id/members` hands out `MEMBER`
and `OBSERVER` only, and PATCH rewrites the matching `project_members` rows
whenever a leadership column changes.
**Why.** Both places carry the answer, and a member endpoint that could write
`PROJECT_LEAD` would let a project have two leads that disagree, one on the
project row and one in the member list. The directory sorts and filters on the
column, so the column has to be right.
**Instead of.** Treating `project_members.role` as the only truth and dropping
the columns, which costs a join on every directory row; or letting the invite
endpoint set any of the four roles and trusting callers to keep both in step.
**Costs.** Reassigning a lead is a multi-row write and has to stay inside the
transaction in `ProjectsService.update`. The outgoing leader is demoted to
`MEMBER` rather than removed, which is a choice somebody will eventually want
configurable.

## 2026-08-16 The project lifecycle table is exactly the diagram

**Decision.** `PROJECT_TRANSITIONS` transcribes the lifecycle diagram in
`p2_projects.md` literally, so `CANCELLED` is reachable from `ACTIVE` and from
nowhere else, and the pure `canTransition(from, to, hasClosureReport)` is
tested against every ordered pair of statuses.
**Why.** The obvious extra edges, cancelling a `DRAFT` or an `ON_HOLD` project,
are plausible rather than specified. Adding them here would make the code and
the handbook disagree, and the handbook is what the client signed off.
**Instead of.** Guessing the full graph, or accepting any enum value on PATCH,
which is a text field with extra steps.
**Costs.** A `DRAFT` nobody wants has to be deleted rather than cancelled.
Adding an edge later is two lines in the table and two cases in
`project-lifecycle.spec.ts`.

## 2026-08-16 Every controller-owning module imports AuthModule

**Decision.** A module registering a controller imports `AuthModule`, and
`just boot-check` builds the Nest container in CI to prove it.
**Why.** `JwtAuthGuard` and `RolesGuard` are global `APP_GUARD` providers, but
Nest instantiates them inside whichever module owns the controller, so that
module needs `JwtService` in scope. The Phase 2 module stubs imported
`PrismaModule` and `NotificationsModule` only. Every one typechecked, every
test passed, and the API did not start: `Nest can't resolve dependencies of the
JwtAuthGuard`. Nothing in the existing checks could see it, and it was found by
an agent trying to run the server rather than by any gate.
**Instead of.** A static grep for `AuthModule` next to `controllers:`, which was
written first and immediately produced three false positives on modules that
boot fine. A check that lies is worse than no check. Building the container is
the real question, and `NestFactory.create` answers it without touching a
database because it returns before `onModuleInit`.
**Costs.** CI needs placeholder values for the environment variables two modules
read at import time, so that list has to stay in step with
`server_env_required`. The check takes a few seconds.
## 2026-08-16 A member's checklist PATCH is a different DTO, not a filtered one

**Decision.** `PATCH /projects/:id/checklist/:itemId` binds the Lead field set,
then narrows a non-Lead body through `toMemberTick` to `MemberTickChecklistDto`,
which holds `is_done` and nothing else. Extra keys are dropped rather than
rejected.
**Why.** Progress is computed from checklist completion and cannot be set by
hand. A member who can also write `due_date`, `priority`, `title` or
`assigned_to_id` on their own item can move the goalposts instead, which is the
same edit through a longer path. Nest binds one body type per route, so the
whitelist has to be applied after the role is known.
**Instead of.** One DTO with every field optional and an `if` per assignment in
the service, which puts the rule in six places and adds a seventh the next time
a field is added. Rejecting extra keys was considered; a UI reusing the Lead's
form is a client bug, not an attack, and a 400 there is unhelpful.
**Costs.** The route's declared body type is wider than what a member can
actually write, so the OpenAPI shape overstates member permissions. The
narrowing is one exported function with a test, not a comment.

## 2026-08-16 Project health is recomputed inline on the tick that finishes a list

**Decision.** `deriveHealth` is a pure function in
`project-execution.service.ts`. The execution service calls it for one project
after a checklist tick, a milestone status change, or a deletion; the daily
sweep in `project-deadline.cron.ts` calls it for every project with a deadline.
**Why.** `health` is a stored, indexed column the project directory filters on,
so deriving it at read time would leave the filter and the index querying stale
rows. Waiting for the next sweep to notice a checklist finished at 3pm is a day
of a project showing DELAYED after it was delivered.
**Instead of.** A computed getter, which breaks the filter. Or sweep-only, which
is correct but a day late on the one change users watch for.
**Costs.** Two callers of the same function, so a rule change has to keep both
in mind. The function is pure and exported specifically so they cannot drift.
## 2026-08-16 DELAYED means the deadline passed, and nothing else

**Decision.** `deriveHealth` returns `DELAYED` only when `projects.deadline` is
in the past. Overdue checklist items, overdue milestones, and arriving in the
last week with under 80 percent of the checklist done all return `AT_RISK`.
**Why.** `deadline` is nullable and plenty of projects will never set one. A
rule that let overdue items alone reach `DELAYED` would put a project with no
deadline into the worst band, which reads as a broken filter to whoever built
the "Overdue" view next to it.
**Instead of.** Scoring the four inputs and thresholding the score. The weights
would have been invented, nobody could explain a particular badge, and the
directory filter has three values to sort into rather than a number.
**Costs.** A project with twenty overdue items and a deadline three months out
sits at `AT_RISK` alongside one with a single late item. Add a second threshold
on the overdue count if the badge stops discriminating.

## 2026-08-16 The MD overdue escalation repeats daily

**Decision.** `PROJECT_OVERDUE_NO_CLOSURE` is sent to every active MD on every
sweep while the project stays past its deadline with no closure report.
**Why.** It matches the task escalation sweep next door, and a one-shot
notification on the first overdue day is one an MD can miss entirely. There is
no per-project reminder state to track this way.
**Instead of.** A `last_escalated_at` column, which is schema for a problem
nobody has reported, or a first-day-only send, which is silent from day two.
**Costs.** An MD with ten projects stuck past their deadline gets ten
notifications a day. The gate is one modulo on the overdue day count in
`project-deadline.cron.ts` when somebody complains.
## 2026-08-16 An observer cannot read the project message thread

**Decision.** `GET /projects/:id/messages` is gated exactly like the POST:
`PROJECT_LEAD`, `CO_LEAD`, and `MEMBER` only. An observer gets the same 403 as a
non-member.
**Why.** [Projects](p2_projects.md#endpoints) marks both message routes "members
(not observers)", which sits next to the sentence saying an observer reads
everything a member reads. The endpoint table wins: everything else about a
project is company-wide reading, but a conversation is participation, and an
observer who can read the thread is in the room.
**Instead of.** Letting observers read and not post, which is the rule for the
checklist and the outcome log. That would make the thread the one place where a
stakeholder watches a discussion they cannot answer.
**Costs.** A stakeholder chasing a project has to ask for MEMBER to follow the
discussion, which is a membership change rather than a permission tweak.

## 2026-08-16 Outcomes are grouped by type on read and logged to the activity trail

**Decision.** `GET /projects/:id/outcomes` returns `{ TRY, FAILURE, OUTCOME }`
rather than a flat list, `POST` requires an explicit `entry_type` with no
default, and there is no update or delete route. Creating one writes a
`project_activity_logs` row; posting a message does not.
**Why.** The three kinds each get their own affordance on the page, and an API
that hands back a flat list with a type column is the one that quietly becomes a
dropdown on a generic entry form. Failures being first-class is the unusual part
of this module and the part most likely to be flattened away. The entries are
permanent project knowledge, so a failure cannot be edited out later.
**Instead of.** A flat list the client groups, which works until the client
stops bothering; or reusing the message thread with a type column, which is the
same collapse by another route.
**Costs.** A correction to an outcome means posting another entry, and the log
grows monotonically. Grouping in the service means a client wanting a single
merged timeline has to interleave three arrays.

## 2026-08-16 One project room carries both messages and checklist ticks

**Decision.** `project:<id>` follows the existing `task:<id>` pattern, with
`project:join` and `project:leave` handlers and no authorisation on the join.
Both `project:message:new` and `project:checklist:updated` go to it.
**Why.** It is the pattern already in `notifications.gateway.ts` and the one the
client's socket hook already knows how to drive. Two rooms, one per sensitivity
level, is a second thing to join and leave for one event type.
**Instead of.** Gating the join on a `project_members` lookup, which is the
correct thing and is not done here. Anyone with a valid token can join
`project:<id>` and receive its thread, which is wider than the REST rule this
same branch enforces on `GET /messages`.
**Costs.** That gap is real and named in
[Notifications and realtime](p1_notifications.md#project-rooms). It gets worse
when Phase 2 puts external vendor logins on the same namespace, so the lookup
should land before the vendor portal does.
## 2026-08-16 HR reads every department's holidays, but only in this module

**Decision.** `HolidaysService` treats HR as company-wide, alongside the
unrestricted roles `DepartmentScopeService` already knows about. HR is not added
to that service's unrestricted list.
**Why.** HR owns the common tier and edits any department's tier, so a holiday
screen scoped to HR's own department is unusable. But `DepartmentScopeService`
is the one gate for tasks, self actions, scores and incentives, and widening HR
there would open all four at once for a role whose scope in those modules has
never been decided.
**Instead of.** Adding `HR` to `isUnrestrictedRole`, which is a two-line change
with a blast radius of every module. Or a `hasCompanyWideAccess(user, domain)`
argument on the shared service, which is a config knob for one caller.
**Costs.** A second module needing the same widening will copy the three-line
check rather than share it. Move it into `DepartmentScopeService` behind an
explicit domain when there is a second caller, not before.

## 2026-08-16 A holiday date held by both tiers resolves to the common row

**Decision.** `mergeEffectiveCalendar` drops a department-wise holiday when a
common holiday already claims that date. The common row is the one returned.
**Why.** The calendar's job is to answer "is this a working day", and a day
excluded twice is a leave application short one day. The union has to be a set
of dates, not a concatenation of rows.
**Instead of.** Returning both and deduplicating in each caller, which is the
same rule written once per consumer with one chance each to forget it. Or
preferring the department row as the more specific one, which would make the
same company holiday render under a different name per department.
**Costs.** The suppressed department row is invisible to the screen that could
delete it. It is inert, it excludes a day that is already excluded, so this is
a cosmetic gap rather than a correctness one.
## 2026-08-16 The vendors controller carries no route prefix

**Decision.** `VendorsController` is declared `@Controller()` and each route
names its full path, so `/vendors` and `/vendor-categories` are served from one
class.
**Why.** `vendors.module.ts` registers three controllers and is closed to
feature branches, and categories are a five-row lookup table that does not earn
a fourth. A controller cannot hold two prefixes without registering every route
under both, which would publish `/vendor-categories/pickable`.
**Instead of.** `@Controller(['vendors', 'vendor-categories'])`, which does
exactly that. Or hanging categories off the access controller, where they have
nothing to do with who can open the module.
**Costs.** The route paths are no longer visible from the class decorator
alone, so `just routes` is the honest answer to what this controller exposes.
The literal-before-parameterised rule still applies: `vendors/pickable` is
declared above `vendors/:id` and has to stay there.

## 2026-08-16 Vendor categories are seeded on boot, not by a migration

**Decision.** `VendorsService.onModuleInit` runs a `createMany` with
`skipDuplicates` over the ten seed categories. A failure is logged and
swallowed.
**Why.** The list is business data with a unique name, not schema, and there is
no seed script in this repository to add it to. `skipDuplicates` makes every
boot after the first a no-op, and a category retired later is deactivated
rather than deleted, so the seed does not resurrect it.
**Instead of.** An `INSERT` in the Phase 2 migration, which cannot be corrected
without a second migration and reseeds nothing on a fresh environment that
skipped it. Or seeding lazily on first read, which puts a write in a GET.
**Costs.** One query at boot, and a category deleted rather than deactivated
comes back on the next restart. Deleting a category is not an endpoint, so that
only happens by hand in the database.

## 2026-08-16 MD and EA are refused a vendor_dashboard_access row

**Decision.** `POST /vendor-access` rejects a target whose role is MD or EA
with a 400, and rejects a `VENDOR` target outright.
**Why.** MD and EA hold `VENDOR_ADMIN` implicitly in `VendorScopeService`, so a
row saying `VENDOR_VIEWER` for an EA would be read by the access list screen
and by nothing else. Two sources for one answer, disagreeing.
**Instead of.** Accepting the row as a harmless no-op, which leaves the grants
screen reporting an access level the API does not honour.
**Costs.** Revoking access from an MD or EA is not possible through the API,
which is correct today and becomes a real gap only if the implicit grant is
ever meant to be removable. That would mean dropping the role branch in
`accessLevelFor` and granting them rows like everyone else.
