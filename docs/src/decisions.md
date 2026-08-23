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
## 2026-08-16 Document expiry is one exported function, called from both paths

**Decision.** `documentExpiryStatus` is a pure function exported from
`vendor-work.service.ts`. The document list calls it on read and the nightly
deadline sweep calls the same one. `vendor_documents` has no status column.
**Why.** A stored status is wrong the morning after it is written, and two
calculators drift by a day, at which point the list and the reminder email
disagree and nobody can say which is right.
**Instead of.** A status column maintained by the sweep, which is stale between
runs; or a private method per caller, which is the two-calculator problem.
**Costs.** Filtering documents by expiry status has to happen in memory rather
than in the `where` clause. Fine at the row counts here; if a document list
ever needs pagination by status, the answer is a generated column in Postgres,
not a written one.

## 2026-08-16 Vendor deadline reminders fire on fixed lead days

**Decision.** The sweep notifies at 30, 14, 7, 3 and 1 days out and on the day
itself, to the vendor's internal owner, its secondary owner, and everyone
holding a `vendor_dashboard_access` row. Recipients are filtered against
`users.vendor_id`, so a portal login can never receive one.
**Why.** The window is thirty days and the sweep is daily, so notifying on
every run is thirty emails per expiring document. These types default to
`IN_APP` plus `EMAIL`, and the recipients would filter the sender inside a
week and then lose the approvals with it.
**Instead of.** Every day inside the window, which is the spam above; or a
`last_notified_at` column per row, which is state to migrate and back-fill for
a schedule that is six fixed numbers. MD and EA are not included implicitly
despite holding admin access, because a daily digest of every vendor's document
expiry is not something either asked for.
**Costs.** An expiry created inside the window with no matching lead day gets
no reminder until the next one comes round, and nothing goes out after a date
has passed. The deadline view carries the overdue rows instead.

## 2026-08-16 Vendor documents record an upload, they do not perform one

**Decision.** `POST /vendor-documents` takes `file_url` and `storage_path` for
a file already uploaded through the attachments module, and rejects a path
outside the `vendors/documents/` prefix.
**Why.** `AttachmentsService` owns the only Supabase client in the API. A
second one here would be a second uploader with its own validation, size
limits and signed-URL handling to keep in step with the first.
**Instead of.** A multipart route on this controller, which needs
`VendorsModule` to import `AttachmentsModule` and `AttachmentsService` to grow
a vendor-shaped upload method. That is the right end state; it is one import
line away whenever the two modules land together.
**Costs.** Two calls from the client to attach a document, and deleting a
vendor document drops the row while leaving the Supabase object behind.
## 2026-08-16 The CareerX employee sync sees deactivated users

**Decision.** `GET /internal/employees` filters out soft-deleted users and keeps
deactivated ones, with `isActive: false`. A null `is_active` reads as false.
**Why.** CareerX deactivates an `hr_employees` row by seeing that flag flip. A
user dropped from the payload leaves CareerX holding whatever it had, so
somebody who has left the company keeps their career portal access.
**Instead of.** Filtering on `is_active: true`, which is the obvious reading of
"active employees" and is exactly the mistake this inverts.
**Costs.** The payload carries every user who has ever existed and not been
deleted, which grows without bound. Fine at this headcount; add a
`?changedSince=` parameter when the cron starts noticing.

## 2026-08-16 The career tab navigates rather than iframes

**Decision.** The Career tab sends the browser to CareerX in the same tab, with
a `returnTo` query parameter carrying an absolute PerformX URL for CareerX's
shell to render as a link back.
**Why.** The session exchange already works this way, and it needs nothing from
CareerX beyond reading one query parameter.
**Instead of.** An iframe, which needs a chromeless CareerX variant,
`frame-ancestors` headers, and inherits every third-party-cookie restriction
browsers have added; or rebuilding the HR screens against the CareerX API, which
the scope document rules out.
**Costs.** The user visibly leaves PerformX. Acceptable for a tab HR sits in for
a stretch rather than glances at. `returnTo` is an unversioned contract between
the two apps; changing the parameter name breaks the back link silently.

## 2026-08-16 Visitor arrival notifies through the main engine, after commit

**Decision.** `VisitService.checkIn` calls the main `NotificationsService` after
its transaction commits, and logs and swallows any failure.
**Why.** The host is a PerformX user who wants this in their ordinary bell, but
the check-in runs under a VMS token through the separate VMS notification
service. Notifying inside the transaction would announce a check-in that could
still roll back, and throwing afterwards would report a committed check-in as
failed to a receptionist with a visitor standing in front of them.
**Instead of.** The VMS notification service, which delivers to a channel the
employee's dashboard does not read; or emitting inside the transaction, which
trades a false negative for a false positive.
**Costs.** A notification lost to a transient failure is not retried. The bell
is not the record of the visit, `visits` is, so this is a missing ping rather
than missing data.

## 2026-08-16 Own visit history only, not department-wide

**Decision.** `GET /vms/visits/mine` filters on `hostEmployeeId = caller` and
overwrites any `hostEmployeeId` the caller passes.
**Why.** Visitor records carry personal contact details. Every internal role can
see who came to see them, and that is the whole of it.
**Instead of.** Department scoping through `DepartmentScopeService`, which is
the pattern elsewhere and would have been the default reading of "searchable by
employee, department, or date".
**Costs.** A HOD cannot see their department's visitors without going through
`GET /vms/reports/employee/:employeeId`, which is already role-gated. Widen it
with a deliberate decision entry, not by adding a query parameter.

## 2026-08-16 The boot check runs the real entrypoint

**Decision.** `just boot-check` compiles the server and runs `dist/main.js`,
rather than importing `AppModule` through `ts-node --transpile-only`.
**Why.** The ts-node version reported success on a build that could not start.
It printed neither its success line nor its failure line, exited 1, and the
recipe read that as a pass. The failure it was written to catch, `RndModule`
missing `AuthModule`, went through it and was found by running the compiled
server by hand.
**Instead of.** Keeping ts-node and parsing its exit code more carefully, which
is guessing at why a process died silently. Running the thing whose behaviour
is in question is cheaper than modelling it.
**Costs.** The check now pays for a `nest build`, so it is seconds rather than
instant. It also starts the app, which tries to reach the database; the DI graph
resolves first, so a connection failure is not a boot failure and the check
ignores it.
## 2026-08-16 An R&D member's research thread is the categories they have written in

**Decision.** `visibleCategories` derives a member's readable categories from
the distinct `rnd_reports.category` values they have already submitted. There is
no assignment table and no per-member category list.
**Why.** The scope document asks for continuity within a member's own research
thread. The set of categories somebody has filed research in is exactly that
set, and it needs no screen, no roster field, and no second thing for the MD to
keep current.
**Instead of.** An `rnd_member_categories` table, which needs a UI to populate,
goes stale the moment somebody researches something new, and can disagree with
the reports that already exist.
**Costs.** A brand new member reads nothing until their first submission, and
they type the category that starts their thread rather than picking it from a
list. If the MD ever wants to assign a thread before the first report, that
table is the upgrade and `visibleCategories` is where it plugs in.

## 2026-08-16 Reading an R&D report as MD is what closes the edit window

**Decision.** `GET /rnd/reports/:id` stamps `md_viewed_at` when the caller is
MD, EA, or PA, and `PATCH` is refused once it is set.
**Why.** The rule wanted is "the submitter can fix a typo until it has been
read". Reading is the event; anything else is a second action somebody has to
remember to take.
**Instead of.** An explicit acknowledge button, which is a step that gets
skipped and leaves reports editable forever, or a fixed time window, which is
wrong in both directions.
**Costs.** A GET has a side effect, which is surprising in a REST API and means
the MD cannot preview a report without ending the edit window. The detail sheet
on the client fetches by id for that reason rather than reusing the list row.

## 2026-08-16 R&D report visibility lives in one pure function

**Decision.** `server/src/modules/rnd/rnd-visibility.ts` exports
`visibleCategories(role, isMember, memberCategories)` and every read path in
`RndService` goes through it.
**Why.** The list, the detail endpoint, and the category list all need the same
answer. Three copies of a three-branch rule is how a member ends up reading
another thread from one of them.
**Instead of.** A `where` builder that takes Prisma types, which cannot be
tested without a database, or inline branches per endpoint.
**Costs.** One more file in a module that would otherwise be three. It buys
`rnd-visibility.spec.ts`, which is the only test in the module.
## 2026-08-16 A 29 February birthday shows on 28 February

**Decision.** In a non-leap year, a leap day birthday appears on the dashboard
on 28 February. The rule lives in the SQL in `DashboardService`, with a comment
saying so.
**Why.** The three options were 28 February, 1 March, or nothing. Nothing means
a card once every four years, which reads as a bug to the person who does not
get one. 28 February keeps the card inside February, which is where people
expect a February birthday.
**Costs.** On 28 February in a non-leap year two people can appear on one day,
one of whom was born on the 28th and one on the 29th. That is the intended
outcome, but it is why the query has an OR branch rather than a single date
comparison.

## 2026-08-16 Poll open state is computed, not stored

**Decision.** Whether a poll accepts votes is derived from `closes_at` on every
read. `is_closed` stays as a column but only for manual early closure by the
creator.
**Why.** The alternative is a cron flipping a boolean at midnight. A job that
fails silently leaves a closed poll accepting votes, and nothing surfaces the
failure until somebody complains about the result.
**Instead of.** A scheduled sweep, which needs monitoring nobody will build for
a poll feature.
**Costs.** Every list query filters on both `is_closed` and `closes_at` rather
than on one column. The composite index `(is_closed, closes_at)` already exists
for exactly this.

## 2026-08-16 The dashboard social layer rides in the dashboard call

**Decision.** Birthdays, the next holiday, and active polls are fields on the
existing `GET /dashboard` payload rather than three more endpoints. Polls are
capped at five inside the payload.
**Why.** The dashboard loads on every login. Four requests where there was one
makes the first paint of the most-seen screen in the product worse for no
benefit.
**Instead of.** `GET /dashboard/birthdays` and friends, which the specification
offered and then advised against. Holidays are read from the table directly here
rather than by calling `/holidays/upcoming`, because a service calling its own
API over HTTP to avoid a join is not a saving.
**Costs.** The dashboard payload grows and `DashboardModule` now imports
`PollsModule`. When a list outgrows one screen it gets paginated in place, which
is more fiddly than a dedicated endpoint would be.

## 2026-08-16 No birthday_cards table and no BIRTHDAY_TODAY notification

**Decision.** Birthday cards are a derived view of `users.date_of_birth`. There
is no table and no notification type.
**Why.** A table holds nothing the column does not already answer, and it would
need one job to populate it and another to expire it. A notification for every
birthday in a hundred-person company is noise in the one channel people are
supposed to trust; the channel map deliberately has no such type.
**Costs.** The birthday list is a raw query rather than a Prisma find, because
matching month and day while ignoring the year is not expressible in the query
builder.
## 2026-08-16 The vendor portal is a namespace, not a role branch

**Decision.** Every route an external vendor can reach lives in
`modules/vendor-portal/` on the `/vendor` and `/vendor-deliverables` prefixes,
with `role_enum.VENDOR` on the controller and a `VendorScopeService` call in
every service method. No internal controller carries the role.
**Why.** `RolesGuard` only checks that `user.role` is in the `@Roles(...)` list.
Adding `VENDOR` to `GET /tasks` would open every task in the company to every
vendor, and the scope check that stops it would be a line in a shared service
that an unrelated refactor can drop without a test failing. A separate namespace
makes the blast radius of a mistake one file, and `just vendor-roles` turns the
convention into a build failure.
**Instead of.** A role branch inside the existing task, project, and dashboard
controllers, which is fewer files and is the arrangement where a leak looks like
a missing `if`.
**Costs.** `/vendor/tasks` duplicates a small amount of `GET /tasks`, and the
two will drift. That is the intended trade: the vendor select list is
deliberately narrower (no department, no assignee, no history) and should not
inherit changes to the employee one by accident.

## 2026-08-16 The vendor message thread has no way to ask for internal notes

**Decision.** `VendorPortalService.sharedThread(vendorId)` hardcodes
`is_internal: false` and takes no flag. The portal has no other path into
`vendor_notes`.
**Why.** Section 12 of the vendor chapter makes internal notes RUCHI-only. A
method taking `isInternal` as an argument is one caller typo away from serving
them to the vendor, and the mistake would read as a normal parameter at review.
**Instead of.** A shared `notes(vendorId, isInternal)` used by both halves of
the module, or a `where` assembled by the caller.
**Costs.** The internal Vendor Management half writes its own read for the
internal thread rather than reusing this one. That duplication is the point.

## 2026-08-16 TaskLifecycleService is provided twice rather than exported

**Decision.** `VendorPortalModule` lists `TaskLifecycleService` in its own
`providers` instead of importing `TasksModule` for it.
**Why.** The service holds no state and takes no constructor arguments, so a
second instance is a second copy of a lookup table. Exporting it would mean
editing `tasks.module.ts`, and the Phase 2 rule is that a feature branch touches
its own module directory.
**Costs.** Two instances of a stateless class. If it ever grows a dependency or
a cache, this becomes wrong and the module should import `TasksModule` instead.
## 2026-08-16 Leave balances run on a financial year starting 1 April

**Decision.** `leave_balances.year` is the financial year named by the calendar
year it starts in, so 16 August 2026 and 10 February 2027 are both year 2026. An
application deducts from the financial year its start date falls in.
**Why.** Entitlement, carry forward and the payroll the monthly export feeds are
all reconciled against the Indian financial year. A balance that reset on 1
January would disagree with the payroll run it exists to serve.
**Instead of.** A calendar year, which is one line simpler and wrong from April
onward; or storing the year as `2026-27`, which turns the `year - 1` carry
forward lookup into a parse.
**Costs.** Leave running 29 March to 2 April deducts entirely from the year it
starts in. Splitting it needs two balance rows and a rule for which one runs out
first; the upgrade path is written at the deduction in `leave.service.ts`.

## 2026-08-16 Weekly offs are a constant, not a table

**Decision.** `WEEKLY_OFF_DAYS` in `server/src/modules/leave/leave-days.ts` is
Sunday, for everybody. Holidays come from the `holidays` table as the union of
the company-wide rows and the applicant's department's.
**Why.** RUCHI works one pattern. A per-employee shift calendar belongs to the
attendance module, which is an optional add-on that does not exist, so a table
for it would be a schema nobody writes to and a join on every day count.
**Instead of.** A `work_schedules` table keyed by user or department, which is
the right answer the day somebody works Sundays and speculation until then. Or
an environment variable, which is a value that never changes dressed as
configuration.
**Costs.** Alternate-Saturday and shift patterns cannot be expressed, and
changing the pattern is a deploy rather than a settings screen. The upgrade path
is to read the constant from a row and pass it to `countLeaveDays`, which
already takes the holiday set as an argument for exactly this reason.

## 2026-08-16 Leave balance rows are created on read, not by a cron

**Decision.** `LeaveService.ensureBalance` upserts a financial year's row the
first time that year is read or deducted, seeding `carried_over` from the
previous year capped at `max_carry_forward`.
**Why.** A scheduled job's only failure mode here is silence on 1 April,
discovered when leave stops working. Nothing on this deployment monitors a cron.
**Instead of.** A job that creates every row for every active user. More code, it
needs a backfill for anybody who joins after it runs, and it fails closed at the
worst possible moment.
**Costs.** A read endpoint writes as a side effect, which surprises whoever
debugs it first, and `GET /leave/balances` shows rows sparsely until a year is
under way. `upsert` rather than `create` because two tabs opening the balance
screen together would otherwise race on the unique index.

## 2026-08-16 The MD approves leave, because nobody approves their own

**Decision.** `approved_by_id != user_id` is enforced in `LeaveService`, and the
MD is on `PATCH /leave/applications/:id/approve` and `/reject` alongside HOD and
HR. A HOD's or an HR user's own application notifies the MD at submission.
**Why.** With one approval stage and company-wide HR authority, an HR user
approving their own leave is a single click with nothing in its way. Leaving the
MD off those endpoints, as the table in [Leave management](p2_leave.md) does,
would make an approver's own application unapprovable by anyone.
**Instead of.** A second mandatory HR stage, which the scope document dropped on
purpose; or trusting the UI to hide the button, which is not enforcement.
**Costs.** The MD can approve anybody's leave, not only an approver's. That
matches every other place the MD is unrestricted but is wider than the rule
needs. It is not a duration-based MD stage; if long leave should reach the MD
generally, that is a separate rule and a separate entry.
## 2026-08-16 The employee trend screen shows stored counts, not a fixed model

**Decision.** `/scoring/*` and the two screens over it report
`assigned_tasks_completed`, `self_actions_completed`, `overdue_tasks_count` and
the points total, and label the total as unbounded points. No percentage, no
rating out of anything, no progress bar with a maximum. The employee scoring
formula is not changed in this phase.
**Why.** The stored composition is three counts; the points total also carries
review credit and a nightly-recalculated overdue penalty that are never stored
per month, so the arithmetic cannot be shown from the table. Fixing the model is
its own sequence - agree the formula in writing, implement it, recalculate
history, then build the screen - and it does not fit the analytics allocation.
Drawing an unbounded number as a score out of 100 produces complaints that no
amount of UI work answers.
**Instead of.** Rendering `final_score` on a 0-100 bar next to the HOD score,
which invites averaging two scales that are not comparable. Or recomputing the
composition on read, which would disagree with the stored numbers every report
already quotes.
**Costs.** The screen shows what was counted but not how the total was reached,
and a user whose points fell has no on-screen explanation. That gap closes when
the model is fixed, not before.

## 2026-08-16 A month with no stored score is drawn, an empty history is not

**Decision.** `buildScoreTrend` emits a gap point (`hasScore: false`,
`points: null`) for a month inside the window with no row, but returns an empty
series when there are no rows at all.
**Why.** Skipping a gap draws five bars as though they were six consecutive
months, which is a chart that lies. Filling a never-scored user's window with
six gaps reads as six bad months rather than as no data.
**Instead of.** Always filling the window, or always skipping gaps. Each is
right in one of the two cases and wrong in the other.
**Costs.** Two shapes for the client to handle, and an empty array is the only
signal for "never scored". Both are covered in `score-trend.spec.ts`.

## 2026-08-16 The scoring controller resolves department scope, the service does not

**Decision.** `ScoringController` injects `DepartmentScopeService` and passes the
resolved scope into `ScoringService.assertDepartmentVisible`.
**Why.** `DepartmentScopeService` is request-scoped. Injecting it into
`ScoringService` would make that service request-scoped, which would in turn
make `ScoringCron` request-scoped and stop `@Cron` from ever firing - a silent
failure that only shows up as scores that stop updating.
**Instead of.** Injecting it into the service like every other module does,
which is the majority pattern but is unsafe for the one service a cron holds.
**Costs.** A scoring rule sits one level up from the rest of its module, and any
future caller of these methods has to supply a scope rather than being handed
one.

## 2026-08-16 The client analytics module is the scoring API, not a second one

**Decision.** `client/src/api/analytics.ts` is deleted along with the unused
`useScores`, `useUserScore` and `useAnalytics` hooks. The analytics and scoring
screens read `api/scoring.ts` and `api/hod-score.ts` through
`hooks/useAnalytics.ts`.
**Why.** `analyticsApi` called `/analytics` and `/analytics/departments/:id`,
and `scoringApi` called `/scoring` and `/scoring/:id`. None of those routes has
ever existed on the server. Leaving them there while adding real ones invites
the next person to wire a screen to a 404.
**Instead of.** Keeping them and adding the real calls alongside, which is two
plausible-looking clients for one domain.
**Costs.** Anything that wants a company-wide analytics rollup now has to add
the endpoint first rather than finding a client function waiting for it.

## 2026-08-16 Events ship without checklists

**Decision.** The events module builds the budget path only: events,
coordinators, expenses with receipts, and the variance report. No checklists,
and `project_checklist_items.event_id` stays unused.
**Why.** Events are the documented first thing to cut, and the only checklist
service in the codebase is `ProjectExecutionService`, whose every method gates
on project membership and derives project progress from the same rows. Making
it serve events means rewriting its permission model and its progress
calculation from inside the module most likely to be deleted.
**Instead of.** A second checklist table, which the spec forbids outright; or
generalising the projects one, which is a projects-shaped change landing in an
events branch and puts two features in one review.
**Costs.** An event cannot hold a to-do list. The column and its index already
exist, so adding one later is a service change and no migration: an event
checklist is `ProjectExecutionService` with `event_id` where it currently
passes `project_id`, and coordinator checks where it currently checks project
role. That belongs in a projects branch.

## 2026-08-16 Event money is a string end to end

**Decision.** `budget_estimated` and `event_expenses.amount` cross every
boundary as fixed two place strings. DTOs validate with `@IsDecimal`, Prisma
takes the string straight into the Decimal column, sums happen in
`Prisma.Decimal`, and the client formats without parsing.
**Why.** The whole module is one arithmetic question, and a JSON number is a
double. A thousand expenses of 0.03 sum to 30.00000000000038 in binary floating
point, which reports a fully on-budget event as over budget. That is exactly
the kind of wrong that nobody reports as a bug.
**Instead of.** Numbers in the DTO with rounding at the edges, which needs
every future caller to remember the rounding; or `prisma.aggregate` for the
sum, which is correct but leaves the arithmetic untestable without a database.
The pure function in `events/budget.ts` is tested in `budget.spec.ts` instead.
**Costs.** A request body with `"amount": 1200.5` is a 400 rather than a
coercion, so every client has to send `"1200.50"`. The client also needs its
own grouping helper, since `Intl.NumberFormat` wants a number.

## 2026-08-16 Event receipts are storage paths, not URLs

**Decision.** `event_expenses.receipt_url` holds the Supabase storage path.
`AttachmentsService` grew `uploadEventReceipt` and made `createSignedUrl`
public; events signs the path on every read.
**Why.** Supabase signed URLs last an hour. Storing one puts a dead link in the
database, and the `event_expenses` row is the only record of the file because
that table has no attachment foreign key. `task_attachments` already solves
this by keeping `storage_path` alongside `file_url`.
**Instead of.** A second Supabase client in the events service, which
duplicates the file type and size rules that already exist; or a public bucket,
which makes every receipt in the company world readable.
**Costs.** The column name says URL and holds a path. Deleting an expense
leaves the object in the bucket, so the `events/receipts` prefix needs a sweep
if it ever gets large.
## 2026-08-16 The leave day count is previewed on the client, not asked for

**Decision.** The apply screen computes working days itself from `GET /holidays`
and a Sunday-only weekly off constant, and shows every excluded day by name. The
server still recomputes `days_count` on submit and its number is the one stored.
**Why.** p2_leave.md asks for the arithmetic to be visible the moment the dates
are picked. A round trip per keystroke to a preview endpoint is a second code
path for the same rule, and the second one is the one that drifts.
**Instead of.** A `POST /leave/applications/preview` endpoint, which is a route
and a DTO to keep in step with the real validator for a number the employee is
about to see recomputed anyway.
**Costs.** Two implementations of the same exclusion rule. They disagree if the
weekly off constant changes on one side only, and the disagreement surfaces as a
day count that moves between the form and the submitted row. `WEEKLY_OFF_DAYS`
in `client/src/lib/leaveValidation.ts` is the client half; keep it equal to the
server's configuration value.

## 2026-08-16 Leave request and response bodies are snake_case

**Decision.** The leave client sends `leave_type_id`, `start_date`, `end_date`,
`approval_remark` and `cancellation_reason`, and reads rows in the shape the
Prisma models define, with people resolved through the `attachUsers` convention
(`user_id_user`, `approved_by_id_user`).
**Why.** p2_leave.md names `cancellation_reason` in the endpoint table and writes
every other field in schema case, and `attachUsers` is already the documented way
a Phase 2 row carries a name. `forbidNonWhitelisted` makes a wrong guess a 400.
**Instead of.** camelCase, which `requests` and `transfers` use. Phase 1 is split
between the two conventions, so neither choice is consistent with everything.
**Costs.** The leave module reads differently from `requests` in the same client.
Leave type names come from `GET /leave/types` and are matched by id in the UI,
because Phase 2 tables have no relation to include.
## 2026-08-16 Vendor request bodies use the Prisma column names

**Decision.** The vendor create and update payloads, the note payload and the
access grant payload are snake_case, one for one with the `vendors`,
`vendor_notes` and `vendor_dashboard_access` columns. The zod schema in
`client/src/components/vendors/VendorForm.tsx` is the client half of that
contract.
**Why.** The vendor frontend and the vendor backends are being built in
parallel against a written contract rather than against each other, so the
field names have to be derivable from something both sides already read. The
schema is that thing. Self-actions, the most recent module, already posts
snake_case.
**Instead of.** camelCase, as tasks and requests use. Both spellings exist in
this codebase, so neither is the house style, and camelCase would need a
mapping layer in the service that snake_case does not.
**Costs.** Two spellings of the same idea now have a third module picking a
side. `forbidNonWhitelisted` makes any disagreement a 400 with an unhelpful
body, so the DTO and the zod schema have to change together.

## 2026-08-16 Vendor list reads accept both the array and the envelope

**Decision.** `client/src/api/vendors.ts` normalises every vendor list response
through one `toList` helper that takes either a bare array or a
`PaginatedResponse`.
**Why.** List endpoints in this repository are split between the two shapes and
the vendor controllers are not merged, so committing the screens to one shape
would be a guess that fails at integration rather than at review.
**Instead of.** Picking one and correcting later, which puts the correction in
every component instead of one function.
**Costs.** The union type is in the signature of nine functions. Drop the array
branch once the module lands on a shape.
## 2026-08-16 The projects directory derives Overdue and Due This Week on the client

**Decision.** `GET /projects` carries search, status, health, priority,
department, lead, category and a date range as query params. The "Overdue" and
"Due This Week" toggles filter the returned rows on `deadline` in the browser.
**Why.** Both are exact functions of `deadline` and `status`, which every row
already carries, and the client shipped ahead of the controller. Inventing
`?overdue=true` before the DTO exists means a 400 from `forbidNonWhitelisted`
the day the backend lands with a different name.
**Instead of.** Two more query params, which couple the directory to names
nobody has agreed, or a separate endpoint per toggle.
**Costs.** The two toggles only see the page they were given, so they become
wrong the day `/projects` paginates. Move them into the query params at that
point.

## 2026-08-16 Optional creation sections post to their own endpoints

**Decision.** `POST /projects` takes the project fields only. Milestones, KPIs
and success criteria entered on the creation form are posted afterwards to
`/projects/:id/milestones`, `/kpis` and `/success-criteria` by the same hook.
**Why.** Creation is meant to stay short, and the three extras are already
first-class endpoints. A nested create DTO would be a fourth way to write the
same rows and would need its own validation rules for arrays the detail page
writes one at a time.
**Instead of.** Nested arrays on the create DTO, which duplicates validation, or
dropping the sections from creation entirely, which the scope asks for.
**Costs.** Creation is several requests rather than one and is not atomic: a
failed milestone post leaves the project created without it. The user lands on
the detail page and can add the missing row there, so the failure is visible
rather than silent.
## 2026-08-16 Asset secrets are AES-256-GCM with the auth tag on the ciphertext

**Decision.** `company_assets.secret_cipher` holds base64 of the AES-256-GCM
ciphertext with its 16 byte auth tag appended, `secret_iv` holds a fresh 12 byte
IV per record, and the key is `ASSET_ENCRYPTION_KEY` from the environment.
`asset-crypto.ts` is three exported functions with no Nest in them so the tests
can call them directly.
**Why.** The feature is showing somebody their own password back, so it has to
be reversible, and the module holds the company's bank portal login, so it has
to be authenticated. GCM gives both from `node:crypto` with no new dependency.
**Instead of.** Bcrypt, which is one way and cannot show the password back at
all; base64 or a reversible XOR, which are encoding and would be called
encryption in a review nobody reads; AES-CBC, which encrypts without detecting
tampering; and a KMS or a vault service, which is the right answer at a
different company size and needs infrastructure this project does not have.
**Costs.** The key lives in an environment variable, so anyone with production
env access can decrypt the table. Rotating it does not re-encrypt anything: old
records stop opening and have to be entered again. `GET /assets/:id/reveal`
catches the auth tag failure and answers 422 naming the rotation, because
otherwise it is a 500 that looks like a bug in the server.

## 2026-08-16 Asset visibility is one method that returns a Prisma where clause

**Decision.** `AssetsService.assetScope(user, employeeId?)` is the only place
that decides who sees which assets. List reads use its return value as a `where`
clause; single record reads call it with the record's own `owner_id` and use it
for its throw.
**Why.** Four rules across seven endpoints is twenty-eight chances to get one
branch wrong, and the branch that is wrong is the one that shows an employee
somebody else's bank password. One method means one place to read and one place
to change.
**Instead of.** A guard, which cannot see the record and so cannot express rule
three; or a role check per endpoint, which is the arrangement that drifts.
**Costs.** A single record read costs one extra evaluation of the scope rather
than being enforced by the query itself, so the throw inside `assetScope` is
load bearing. Deleting it would silently open every record.

## 2026-08-16 Handover moves owner_id on confirmation, not on submit

**Decision.** `POST /assets/handovers` writes rows with `completed_at` null and
changes nothing else. `PATCH /assets/handovers/:id/confirm` sets `completed_at`
and rewrites `company_assets.owner_id` in one transaction, with the guard in the
`where` clause so a double submit updates nothing.
**Why.** HR works through a leaver's list over hours or days. Moving ownership
at submit would hide each asset from the leaver the moment HR picked a name,
while HR still needs the list to be complete, and the leaver still needs the
credential until they actually stop using it.
**Instead of.** Moving ownership at submit with a reversal on rejection, which
needs a rejection flow nobody asked for; or a status column on
`company_assets`, which puts handover state on the wrong table.
**Costs.** An asset with a handover open still belongs to the leaver, so it
appears in their list until the new owner acts. The offboarding screen shows
outstanding, awaiting confirmation and confirmed counts so that state is
visible rather than confusing.

## 2026-08-16 Documents reuse the attachments uploader instead of a second one

**Decision.** `AttachmentsService.uploadToStorage` was extracted from the
existing `uploadFiles` loop and made public. It validates, uploads to the same
Supabase bucket and returns the file fields without creating a
`task_attachments` row. The assets module calls it and keeps `file_url` and
`storage_path` on `company_assets`.
**Why.** A DOCUMENT asset is a file with a different owner table, not a
different kind of upload. A second uploader means a second bucket path
convention, a second size limit, and a second place to fix a MIME bug.
**Instead of.** Writing a Supabase client into the assets service, or giving
documents a `task_attachments` row with every foreign key null.
**Costs.** `AttachmentsService` now has a public method with a caller outside
its own module, so its signature is no longer free to change. `uploadFiles`
routes through it, so a bug there breaks both.

## 2026-08-16 Socket rooms check membership on join

**Decision.** `task:join` and `project:join` authorise before joining.
`role_enum.VENDOR` is refused every room. A task room admits the assignee, the
assigner, and management. A project room admits any internal role, because
project visibility is company-wide by design and writing does not happen over
the socket.
**Why.** Joining previously required nothing but a valid token, so any employee
could watch any task and receive `task:updated` and `task:comment:new` for it,
bypassing every `ensureTaskVisible` check the REST layer makes. Harmless while
every token holder was an employee. Not harmless once an external vendor login
exists on the same namespace. Three separate reviews raised it independently,
which is the signal that it was not a theoretical finding.
**Instead of.** A guard on the gateway, which would need the same database read
anyway and gives no better answer. Or leaving it and relying on nobody
subscribing by hand, which is not a control.
**Costs.** One indexed lookup per join, on an event that fires when a detail
page mounts. `mayJoin` returns false rather than throwing, because a gateway
exception reaches the client as an unhandled error event and a refused join
should read as a refused join.

## 2026-08-16 The Vercel preview installs with bun

**Decision.** `client/vercel.json` sets `installCommand` to
`bun install --frozen-lockfile`, so the preview build resolves from `bun.lock`
rather than `package-lock.json`.
**Why.** `client/package-lock.json` was generated on Windows and records only
`lightningcss-win32-x64-msvc`. npm on a Linux runner installs no native
lightningcss binary as a result, and Turbopack fails on `app/globals.css` with
`Cannot find module '../lightningcss.linux-x64-gnu.node'`. `bun.lock` carries
the linux entry, and the workflow already installs bun for the Vercel CLI.
**Instead of.** Regenerating `package-lock.json` on Linux, which fixes CI and
breaks whoever generated it on Windows, because npm records only the optional
binaries it actually installed. Or deleting `package-lock.json`, which is the
right end state but breaks the `npm ci` in `pr-checks.yaml` in the same commit.
**Costs.** The client carries two lockfiles with two consumers now. CI
typechecks through npm, the preview builds through bun, and they can drift. The
fix is to pick one, which is a change to `pr-checks.yaml` as much as to the
client.

## 2026-08-16 bun.lock is the only lockfile

**Decision.** `client/package-lock.json` and `server/package-lock.json` are
deleted, and `pr-checks.yaml` installs both packages with `bun install
--frozen-lockfile`. This completes the follow up named in *The Vercel preview
installs with bun*, which only pointed Vercel at bun and left CI on npm.
**Why.** npm records only the optional binaries it actually installed, so both
lockfiles had been pruned to whoever last generated them, in opposite
directions. `client` carried `lightningcss-win32-x64-msvc` and
`@img/sharp-win32-x64` with no Linux equivalent, which is what broke the preview
build. `server` carried `@napi-rs/lzma-linux-x64-gnu` and nothing else, which
breaks a Windows or macOS checkout. The justfile has said `pm := "bun"` since day
one, so npm was never the package manager here, only a second lockfile drifting
in the corner.
**Instead of.** Regenerating both with npm on Linux, which fixes CI and breaks
the laptops, since the pruning happens again on whichever machine runs it next.
**Costs.** `server/bun.lock` was stale and had to be regenerated: it was missing
`vitest` and every platform native, because `just install` runs `bun install`
without `--frozen-lockfile` and so never complained. CI is now stricter than the
justfile. A `package.json` edit that skips the lockfile fails the PR rather than
passing quietly, which is the point, but it is a new way for a PR to go red.

## 2026-08-22 The assistant is tier 1 only, and there is no RLS

**Decision.** The PerformX Assistant ships with tier 1 and tier 3 from
[The PerformX Assistant](p2_assistant.md) and without tier 2. Around thirty
read-only tools call the same services the controllers call, passing the
caller's own `JwtPayload`. The model never writes SQL, and no row level security
policy was created. A question no tool covers is declined and logged.

**Why.** Tier 2 was made safe by RLS, and RLS means writing the permission model
a second time, in SQL, in the database. `DepartmentScopeService` says in its own
header that it is the only location allowed to determine accessible departments,
and forbids business services from reading `users.department_id`,
`assistant_departments` or `hod_departments` directly. A policy set doing the
same work is exactly the second location that file exists to prevent, and two
copies of an authorization model drift.

The cost was also understated. The API connects as `postgres`, which has
`rolbypassrls`, so policies would not have engaged at all without a new database
role, a session identity threaded through the Supabase pooler, and a red team
suite running on every schema change forever. Meanwhile every module already
exported the service its tools needed, so tier 1 was close to a wrapper job.

**Instead of.** The full three tier design. That buys the analytical tail, the
questions nobody wrote a tool for, and it is a real loss: "does leave correlate
with missed deadlines" is now a decline. The judgement is that a second
permission model is the more expensive thing to own.

**Costs.** Novel analytical questions are declined rather than answered. The
plan was to read a generated-SQL log to decide which tools to add next; with no
tier 2 there is no such log, so `assistant_exchanges.declined` is the signal
instead and `GET /assistant/declines` is the queue. A shape that keeps appearing
there is the next tool to write.

The other cost is subtler. Reaching services in process means the controller's
`@Roles` guard does not run, so each tool carries the role list of the route it
wraps. That is a copy, and copies drift. It is mitigated rather than solved:
every tool names its route in a comment so a guard change is a grep, the catalog
is filtered per caller before it is sent, and `assistant-tools.spec.ts` asserts
that `VENDOR` appears in no tool and that an employee is offered neither
company-wide leave nor anybody else's scores. A shared role constant, rather
than the same nine-role list written out in five files, would remove the drift
properly. That refactor is not in this change.

## 2026-08-22 Leave admin is three screens, not one

**Decision.** The HR administration endpoints get three separate screens at
`/leave/admin/types`, `/leave/admin/balances` and `/leave/admin/reports`, each
gated by its own helper in `components/leave/access.ts`, rather than one Admin
area behind a single role check.

**Why.** The three routes do not share a role list. `POST /leave/types` is HR
and ADMIN, `GET /leave/balances` is HR alone, and `/leave/reports/*` is HR and
MD. A single `isLeaveHr` gate would either show ADMIN a balances button that
403s, or hide the report from the MD who is allowed to read it. The comment at
the top of `access.ts` already said the file exists so that nobody is shown a
button that 403s; one gate for three role lists breaks that.

**Instead of.** One `/leave/admin` page with tabs and a single guard, which is
less code and the obvious shape. It was rejected because the guard would have to
be the union of three role lists and then each tab would need its own check
anyway, which is the same number of checks in a place where they are easier to
get wrong.

**Costs.** Three route files that share a header and a back link. If a fourth
admin screen appears, the shared chrome is worth extracting; three is not enough
to pay for it.

## 2026-08-22 Leave types is the screen that unblocks leave

**Decision.** `/leave/admin/types` ships before the other section 3 screens, and
its empty state says plainly that leave is unusable until a type exists.

**Why.** `leave_types` is empty in production. Until a row exists nobody in the
company can apply for leave, seven of the assistant's tools have nothing to
answer with, and `leave_balances` never gets created because it is seeded on
first application. That single empty table is the root of most of what looks
like a half-built leave module.

**Instead of.** Seeding five types in a migration. Rejected because the
entitlements, the carry-forward rules and whether proof is required per type are
all client decisions nobody has confirmed, and a wrong seeded entitlement is
worse than an empty table: it is silently wrong arithmetic rather than an
obvious gap.

**Costs.** Somebody still has to sit down and enter five types before leave
works. The screen makes that ten minutes instead of a curl session, but it does
not remove the step.

## 2026-08-22 One dialog for the five vendor work forms

**Decision.** `VendorWorkDialog` takes a field spec and renders it;
`VendorWorkForms` supplies five specs, one per work entity. There is no
per-entity dialog component.

**Why.** The five forms differ only in their fields. The shell, the
validate-then-submit, the error placement and the busy state are identical. Five
components would be five copies of the same seventy lines, and the fifth would
drift from the first the week somebody fixed a bug in one of them.

**Instead of.** Five components, which is the obvious shape and reads more
directly at each call site. Rejected on the handbook's own rule: reuse before
you write, and no abstraction with one caller. This one has five.

**Costs.** The field spec is a small language, and small languages grow. It
covers text, date, number, url, textarea and select, and nothing else. A form
that needs something it cannot express should get its own component rather than
push a branch into the spec, and that is written above the type so the next
person reads it before adding a `kind`.

## 2026-08-22 Vendor write buttons are hidden, not disabled

**Decision.** Without `VENDOR_MANAGER` the Add buttons do not render. They are
not shown greyed out.

**Why.** A disabled button invites the question of how to enable it, and the
answer is an access grant that somebody else has to make. Hiding it leaves the
read-only tabs looking deliberate, which they are: `VENDOR_VIEWER` is a real
level with a real purpose.

**Costs.** A manager who has lost access sees the tabs quietly change shape
rather than being told why. The vendor access screen is where that is visible,
and the API is still the real gate either way.

## 2026-08-23 The client and server field names are checked, not agreed

**Decision.** `server/src/common/api-contract.spec.ts` parses every DTO in the
server and every call in `client/src/api`, and fails when a call sends a field
its route would reject. The server keeps its mixed casing.

**Why.** Two chapters of this handbook already told people to keep the zod
schema and the DTO in step, and the whole projects module still shipped unable
to write: `POST /projects` sent `projectType` where the DTO declares
`project_type`, and `forbidNonWhitelisted` turned that into a 400. Password
reset, leave approval, vendor creation, vendor access grants and all six vendor
work tab reads were wrong the same way. A rule nothing enforces is a rule that
holds until the first person who has not read it.

**Instead of.** Normalising the server on one convention, which is the fix that
removes the problem rather than detecting it. Rejected for size: it touches
DTOs, services and every client call at once, days before a demo, with no test
suite on the client to catch what it breaks. Worth doing later, and the spec is
what makes it safe to attempt.

Also rejected: a global interceptor that rewrites incoming keys. There is no
single direction to rewrite in, because the server genuinely uses both, so it
would have to know which module it was serving.

**Costs.** It is regex over two source trees, not a TypeScript program, so it
reads the shapes those trees use today. A call written in a shape it cannot
parse lands in the `unchecked` list, which is asserted, so the failure is a
noisy one rather than a silent pass. Two vendor portal calls that build their
body with a conditional spread are listed in `READ_BY_HAND` and were checked
against their DTOs by hand.

## 2026-08-23 Project editing is its own form, not the creation form reused

**Decision.** `ProjectEditForm` is a separate component from `ProjectForm`.

**Why.** They are different shapes. Creation is a wizard: three required fields
up front and collapsible sections for milestones, KPIs and success criteria that
`useCreateProject` posts to their own endpoints once the project exists. Editing
is a flat list of what one PATCH accepts, and those extras already have their
own tabs on the detail page. One component with a mode flag would branch on that
flag in the defaults, the submit handler, the redirect and half the JSX.

**Instead of.** The vendor pattern, where `VendorForm` takes an optional
`vendor` and serves both screens. That works there because vendor creation and
vendor editing take the same fields. Here they do not.

**Costs.** Two forms for one entity, so a new field on the project has two
places to add it. The `ponytail:` note on the component says to merge them if a
third caller appears or the field lists converge.

## 2026-08-23 Deleting a project is gated apart from editing it

**Decision.** The delete panel on the edit screen checks Lead or MD, separately
from the Lead or Co-Lead check that lets the caller onto the screen at all.

**Why.** `ProjectsService.remove` refuses a Co-Lead, and `update` does not. A
single check would either show a Co-Lead a button that always 403s, or keep the
MD off a screen they are entitled to use.

**Costs.** Two permission expressions on one page, which reads as an
inconsistency until you know the service enforces exactly that.

## 2026-08-23 A holiday tier move is one PATCH, checked against both tiers

**Decision.** `UpdateHolidayDto` takes `departmentId`, where a UUID sets the
department-wise tier and an explicit null returns the holiday to the common
tier. `HolidaysService.update` runs `assertCanWrite` against the tier being left
and again against the tier being joined.

**Why.** The previous answer was a delete plus a create, written down in the DTO
as a deliberate choice. It is not one anybody can follow: two calls with no
transaction between them, and if the create fails on a duplicate the holiday is
gone. The move is also the operation most likely to be wanted, because the usual
reason to touch a holiday is that it was filed against the wrong tier.

The pair of checks is the whole safety argument. Checking only the existing row
would let a HOD move their department's holiday to the common tier and give the
company a day off, which is a larger power than anything else the role has.
`holiday-tier-move.spec.ts` fails on both permission cases if the second check is
removed, which was verified rather than assumed.

**Instead of.** A dedicated `PATCH /holidays/:id/tier`. Rejected because the
authorisation is the same shape as the rest of the update and would be written
twice.

**Costs.** `@IsOptional()` skips null as well as undefined, which is what lets
null mean "move to common". That is not obvious from reading the DTO, so it is
written above the field. Anyone adding a nullable field to another DTO should
know the same trick applies.

`assertCanWrite` now also checks the department exists for HR and ADMIN. They
were the only callers who could pass an arbitrary id, and it reached Postgres as
a foreign key violation and surfaced as a 500. A HOD's id was already proven by
the scope check.

## 2026-08-23 The five leave types are seeded, and two of them start at zero

**Decision.** `just seed-leave-types` creates Casual 12, Sick 12, Earned 15
carrying up to 30, Unpaid 0 unpaid, and Compensatory Off 0 paid. It skips a
type that already exists rather than updating it.

**Why.** `leave_types` was empty, so nobody could apply for leave at all, and
the module had never run against a database. The numbers are the ordinary
private-sector set; they are defaults for HR to correct on the leave types
screen, not policy this repository is entitled to set.

The two zeroes are the part worth reading. The balance check in
`LeaveService.apply` runs only `if (type.is_paid && days > 0)`, so Unpaid Leave
at zero entitlement is never blocked, while Compensatory Off at zero *is*, until
HR credits the earned day on the balances screen. Comp-off being unusable until
credited is the rule, not a gap.

Sick Leave carries no proof requirement, which looks wrong and is not.
`requires_proof` is checked on every application, so turning it on demands a
medical certificate for one sick day. The rule people actually follow starts at
the third consecutive day, and the column cannot say that.

**Instead of.** Seeding balances for every user at the same time. Rejected
because `ensureBalance` already creates a balance lazily at first use, at the
entitlement current at that moment, so 121 users times five types of rows would
be work that buys nothing and freezes today's numbers into next year's rows.

**Costs.** The entitlements are a guess until the client confirms them. That is
cheap now and expensive later: while `leave_balances` is empty a change costs
nothing, and once people have applied it only affects rows created after it.
Verified end to end against the shadow database before seeding production: apply
three days of casual leave, approve, balance moves to 3 of 12; unpaid at zero is
allowed; comp-off at zero is refused.
