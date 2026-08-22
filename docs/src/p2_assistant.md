# The PerformX Assistant

**Status: built, tier 1 only, 2026-08-22.** Shipped as `modules/assistant/` on
the server and `components/assistant/` on the client.

This page is the design as proposed. Two parts of it were not built, and the
difference matters when reading the rest:

- **Tier 2, the model writing scoped SQL, does not exist.** Nor does the row
  level security that was to make it safe. The reasoning is in
  [Decisions](decisions.md), *The assistant is tier 1 only, and there is no
  RLS*: the policies would have been a second copy of `DepartmentScopeService`,
  and that file exists to be the only copy. Everything below under *How tier 2
  stays safe* is unbuilt design, kept because it is the argument to revisit if
  the decline log ever justifies it.
- **The eval set does not exist.** The 150 question set under *Evaluation* was
  to be built from what the client actually asks, and nobody has asked yet.
  `assistant_exchanges` is where it accumulates.

What did get built follows the rest of this page: the tool catalog, the
conversation design, the interface, and Haiku 4.5 as the model.

A conversational surface inside PerformX that lets MD, EA, PA, and HODs ask the
company a question in plain language instead of assembling the answer across
eight screens.

It is not a search box and it is not a report builder. Both exist and people do
not use them, which is why this was asked for. The point is that the user does
not have to know what the data is called, which screen it lives on, or which
filter combination produces the number they want. The design target is an MD
opening it on a phone in a meeting, asking "how are we doing on the Kolkata
project", and getting something useful without a single tap.

## What it has to feel like

Everything below exists to make these interactions work.

**Follow-ups carry context.**

```
MD    How much leave has the design team taken this quarter?

BOT   Design has used 34 of 96 entitled days this quarter (35%).
      Six people, Rahul Sen highest at 9 days.

      [Table: per-person breakdown]

MD    what about last quarter

BOT   Q3 was 51 days (53%). So this quarter is tracking well below,
      though there are five weeks left.
```

Two questions, the second a fragment. The assistant carried "design team",
"leave", and the comparison frame without being told again. That is the
difference between a chatbot and a form.

**It knows what it cannot see.**

```
HOD   how many days was Anil in the office last month?

BOT   PerformX doesn't track attendance, so I can't answer that.

      What I do have for Anil: 3 leave days last month, 12 tasks
      completed, active on 2 projects. Any of that useful?
```

**It refuses cleanly on permissions, and still answers the permitted part.**

```
HOD   what's the leave balance for the whole company?

BOT   I can only show you your own department (Engineering).
      Company-wide leave is MD, EA, PA and HR.

      Engineering's balance: 142 days remaining across 11 people.
```

A flat "access denied" is a bad chatbot.

**It volunteers what you did not ask.**

```
EA    anything I should know about vendors this week?

BOT   Three things:

      1. Sharma Printing's contract expires in 11 days, no renewal
         logged. Owner is Meera.
      2. Two deliverables from Webcraft went overdue yesterday.
      3. GST certificate for Anand Media expired last week.
```

This is the query nobody would build a screen for, and it is the one that makes
an MD open the app.

## Two things to settle before building

### Attendance does not exist

The example the client gave by name, "who went to work how many times", is an
attendance question, and PerformX has no attendance data. Attendance is listed
in [Plan and sequencing](p2_plan.md#scope) as an optional add-on with no
WideAngle development cost. It is not built and not committed. The only check-in
timestamps in the schema belong to VMS and they are for visitors.

The assistant handles this gracefully, but the gap gets named before a demo
rather than during one. Everything else in the transcripts above is answerable
from data that exists today, or that Phase 2 adds.

### A HOD is on the requested user list

The request says MD, HOD, EA, and PA should be able to check every detail about
everybody. Phase 2 went the other way on purpose:

- Asset visibility is self-scoped. EA, PA, and MD see everything, HR sees one
  employee at a time. See [Plan and sequencing](p2_plan.md).
- Vendor dashboard access is a per-person grant from MD or EA, deliberately not
  a role. See [Vendor management](p2_vendors.md).
- Leave routes to the applicant's own HOD. See [Leave management](p2_leave.md).
- HODs are scoped to their department everywhere else in the product.

An assistant that ignores this hands a HOD data the API would refuse them,
through a friendlier interface. The tier 2 design below is how the
conversational surface and the permission model both survive. It is the
load-bearing part of this page.

## Architecture

Three tiers, tried in order. Most questions never leave tier 1.

```
   User question + conversation history
                  |
                  v
        +---------------------+
        |  Model picks a path |
        +----------+----------+
                   |
     +-------------+-------------+
     v             v             v
  TIER 1        TIER 2        TIER 3
  Named tool    Scoped SQL    Decline
     |             |          + suggest
     v             v
  REST API     Read-only DB
  (user JWT)   (RLS session)
     |             |
     +------+------+
            v
      Rows + context
            |
            v
    Model writes the answer
            |
            v
    Text / table / chart
```

**Tier 1, named tools over existing endpoints.** Around thirty tools mapping to
REST endpoints already built and tested. Called with the asking user's own JWT,
so `GET /leave/applications` scopes to their department exactly as it does in
the UI. Fast, cheap, and correct by construction. This covers the routine
questions: balances, task counts, project status, vendor deadlines, holidays.

**Tier 2, scoped SQL for the analytical tail. Not built, see the status note above.** When the question is genuinely
novel, such as whether leave correlates with missed deadlines, the model writes
a read-only `SELECT`. This is what makes it a chatbot rather than a menu.

**Tier 3, decline with a suggestion.** Attendance, anything outside permission,
anything the model is not confident about.

Which tier fires is a model decision, and the eval set measures whether it
routes correctly.

## How tier 2 stays safe

Letting a model write SQL against a production database is normally a terrible
idea. It is acceptable here because of what it writes against.

### Row-level security does the work, not the prompt

Postgres RLS moves the permission check out of the query and into the database.
Every table carries a policy, the connection carries the caller's identity, and
the policy filters rows before the query sees them.

```sql
-- Once, per table
ALTER TABLE leave_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_applications FORCE ROW LEVEL SECURITY;

-- The API keeps working exactly as it does now. Its scoping lives in the
-- service layer and this policy must not second-guess it.
CREATE POLICY leave_app_access ON leave_applications
  FOR ALL TO performx_app
  USING (true);

-- The assistant is the only role the policy below constrains.
CREATE POLICY leave_visibility ON leave_applications
  FOR SELECT TO performx_assistant_readonly
  USING (
    user_id = current_setting('app.user_id', true)::uuid
    OR current_setting('app.role', true) IN ('MD','EA','PA','HR')
    OR (
      current_setting('app.role', true) = 'HOD'
      AND user_id IN (
        SELECT u.id FROM users u
        JOIN hod_departments hd ON hd.department_id = u.department_id
        WHERE hd.user_id = current_setting('app.user_id', true)::uuid
      )
    )
  );
```

Two details in there are load bearing and easy to drop.

Policies are scoped `TO` a role. An unscoped policy applies to `PUBLIC`, which
under `FORCE` includes the application's own connection, and then the API
inherits a permission model it already implements differently in the service
layer. Two policies per table, one per role, keeps the assistant constrained
without the API noticing this exists at all.

`current_setting` takes a second argument. Without it, reading an unset setting
raises rather than returning null, so a connection that forgot to stamp itself
gets an error instead of an empty result. With `true` it returns null, the
comparisons evaluate to null, and no rows come back. Fail closed and quiet beats
fail loud and ambiguous here, because the loud version is indistinguishable from
the database being down.

Every assistant query then runs inside a transaction that stamps the caller:

```sql
BEGIN;
SET LOCAL ROLE performx_assistant_readonly;
SET LOCAL app.user_id = '<asking user>';
SET LOCAL app.role    = '<their role>';
SET LOCAL statement_timeout = '5s';

-- model-generated SELECT runs here, sees only permitted rows

COMMIT;
```

A HOD asking for company-wide leave gets their own department's rows back no
matter what SQL the model writes, because the filter is not in the SQL. That
guarantee is what allows a generous conversational surface.

### The footgun

RLS does not apply to the table owner. By default the role that owns a table
bypasses every policy on it, silently. If the assistant connects as the
application's normal user and that user owns the schema, RLS is decorative,
every test passes, and every policy does nothing.

Two things prevent it. `ALTER TABLE ... FORCE ROW LEVEL SECURITY` on every
policied table, and connecting as a role that is neither the owner, a superuser,
nor `BYPASSRLS`.

`FORCE` is the half that has a cost. It removes the owner's exemption, and the
owner here is whatever role Prisma connects as, so every policy now applies to
the ordinary API as well. That is why the policies above are scoped `TO` a role.
Skip that and the first `FORCE` takes the product down, on a table nobody
thought they were changing.

The red team pass must include a query that should return zero rows, run as the
real assistant role against the real database, and confirm that it does.
Confirming a policy exists is not the same as confirming it fires.

### The rest of the controls

| Control | Why |
| --- | --- |
| Dedicated `performx_assistant_readonly` role, `SELECT` only | No INSERT, UPDATE, DELETE, or DDL. Revoked on every table not needed. Not the schema owner, not superuser, no `BYPASSRLS` |
| Single-statement enforcement | Reject anything with `;`, CTE writes, or multiple statements before execution |
| `statement_timeout = 5s` | A bad join cannot take the database down |
| Mandatory `LIMIT`, capped at 500 | Bounded result size and bounded token cost |
| Parse and validate before execute | Reject non-SELECT at the AST level, not by regex |
| Column denylist | `password_hash`, tokens, anything in the credentials path is unreachable regardless of policy |
| Every query logged with the asking user | Audit trail, and the source of the next batch of tier 1 tools |

The instinct is to put the permission rules in the system prompt and trust the
model. That fails to prompt injection, fails silently, and cannot be tested
exhaustively. Pushing it into RLS means the security property holds even when
the model is wrong, jailbroken, or replaced.

One consequence worth naming: RLS policies are new infrastructure on a live
database, and this schema has no test coverage. Policies get written per table,
reviewed, and tested against a restored production copy before any of this
ships. It is the single largest engineering item in the project and it is not
optional. It also depends on Prisma migrations existing, which is Week 0 work in
[Plan and sequencing](p2_plan.md), and on the schema settling in
[Schema changes](p2_data_model.md).

## Conversation design

The difference between a good assistant and a bad one is almost entirely here,
not in the model choice.

**Memory.** Keep the last ten turns in context, and carry the resolved entities
forward explicitly in a small state object the model sees:

```
active_context:
  department: Engineering
  date_range: 2026-04-01 to 2026-06-30
  subject: leave
  last_result: 34 days across 6 people
```

That is what makes "what about last quarter" work. Without it every follow-up is
a fresh question and the thing feels broken. Sessions expire after 30 minutes
idle. History is stored per user, retained 30 days, visible to that user only.

**Clarify rather than guess.** If a question maps to more than one tool with
similar confidence, ask once, with the options as buttons, never an open "what
do you mean". Ask when guessing wrong would show wrong data. Guess when the
worst case is a slightly off answer the user can redirect.

**Voice.** Direct, short, no preamble. Lead with the number, then the context.
Say `34 of 96 days (35%)`, not `Based on my analysis of the leave records, the
design team has taken approximately 34 days`. One or two sentences of
interpretation after the number when there is something worth saying. Never
apologise twice for the same limitation. Match the user's register.

**Never fabricate.** If a query returns nothing, say it returned nothing. Every
number in an answer traces to a row that came back, and derived figures show
their inputs.

**Always offer the next step.** `Want the per-person breakdown?` is useful. `Is
there anything else?` is filler.

## Tool catalog

Tier 1 tools, each mapping to an endpoint that already exists and already
enforces scope.

| Group | Tools |
| --- | --- |
| People and leave | `leave_balance`, `leave_history`, `leave_pending_approvals`, `team_on_leave`, `upcoming_holidays`, `leave_report_month` |
| Tasks | `my_tasks`, `department_tasks`, `overdue_tasks`, `task_detail`, `task_completion_stats` |
| Projects | `project_list`, `project_detail`, `project_health`, `project_overdue`, `project_checklist_progress`, `project_milestones`, `project_closure_status` |
| Vendors, needs `vendor_dashboard_access` | `vendor_list`, `vendor_detail`, `vendor_deadlines`, `vendor_deliverables_overdue`, `vendor_contract_expiring`, `vendor_performance` |
| Scoring and R&D | `hod_scores`, `department_scores`, `rnd_reports` |
| Assets and visitors | `asset_lookup`, `visitor_log` |
| Org | `user_lookup`, `department_members`, `reporting_line` |

Around thirty. Each needs a description written for the model stating when to
call it, not just what it does. Those descriptions are the highest leverage text
in the project and deserve more iteration than the system prompt.

The tier 2 query log says which tools to add next. Anything that keeps showing
up as generated SQL should become a tool.

## Interface

**Placement.** Persistent chat button, bottom right, on every screen. Opens a
panel, not a page, so the user does not lose their place.

**Context awareness.** Open it on a project page and the assistant knows which
project. "Is this on track?" resolves without naming it.

**Rendering.** Prose for single facts, tables for anything past three rows,
exportable through the existing `exceljs` path, and charts for comparisons using
whatever the dashboard module already uses. Do not add a charting library.

**Streaming.** Tokens appear as they generate. Three seconds with a spinner
feels broken, the same three seconds with text appearing feels fast.

**Transparency.** A collapsed line under each answer, `Checked: leave_balance,
leave_history · 6 people`, expanding to the actual tool calls or SQL. This is
how users learn to trust it and how we debug complaints.

**Feedback.** Thumbs up and down on every answer, whole exchange logged. That is
the eval set growing itself.

**Mobile first.** The MD in a meeting is the primary case. Test there first.

## Evaluation

Build a 150 question set before writing the assistant, drawn from what the
client actually asks. Each entry records the question, the expected tier, the
expected tool or query shape, and the expected answer.

| Metric | Target |
| --- | --- |
| Tool selection accuracy | > 95% |
| Answer correctness, verified against the database | > 98% |
| Correct refusal on out-of-permission questions | 100% |
| Hallucinated numbers | 0 |

The last two are hard gates. A tool selection miss is annoying. A permission
leak or an invented number is a product that gets switched off.

Red team it separately, with questions designed to pull data across the
permission boundary, run as each role with RLS on. That suite runs on every
schema change, forever.

## Model choice and cost

Load assumption: about 15 users, 3 questions each per working day, 25 working
days, so roughly 1,100 questions a month at about 6,000 tokens in and 400 out.
That is 6.6M in and 0.44M out monthly.

Claude prices as published 2026-06-24, converted at ₹90 to the dollar. Anything
not from that source is a band and needs verifying before it goes in a quote.

| Model | Monthly | With caching | Fit |
| --- | ---: | ---: | --- |
| **Claude Haiku 4.5** | **₹800** | **₹350** | Start here |
| Gemini Flash tier | ~₹800 | ~₹350 | Mumbai region available, verify pricing |
| Claude Sonnet 5 | ₹2,380 | ₹1,040 | If tier 2 SQL quality needs it |
| Claude Opus 5 | ₹3,960 | ₹1,730 | Overkill |
| Chinese hosted API | ₹200 to ₹500 | ₹100 to ₹250 | See below |

Caching applies because most of what gets sent each time is byte identical. Tool
definitions and schema context sit behind a cache breakpoint and repeat reads
bill at roughly a tenth. Output is never cacheable, which is why the gap between
models narrows once caching is on.

**The whole company costs under ₹1,000 a month on a good model, and under
₹4,000 on the most expensive sensible one.** Model price is not a real variable
in this decision. Chinese hosted models are genuinely 5 to 10 times cheaper per
token, which saves around ₹700 a month. That does not pay for a single day of
engineering time, and it buys a weaker model on tier 2 SQL generation.

Optimise for tool selection accuracy and latency, and treat inference cost as a
rounding error. The real cost of this project is the RLS work, the tool catalog,
and the eval set.

On Chinese models specifically, the two cases are different decisions.
Open-weight Chinese models on our own hardware are entirely fine, since Qwen and
DeepSeek weights are strong and permissively licensed. Chinese hosted APIs
holding leave records, performance scores, and management notes for a hundred
plus Indian employees are hard to defend, because under the DPDP Act RUCHI is
the data fiduciary and owns that decision. The saving lives entirely in the
option with the weaker privacy story.

## Self-hosting

| Setup | Monthly |
| --- | ---: |
| Cloud GPU, on demand | ₹70,000 to ₹1,30,000 |
| Cloud GPU, 1 year reserved | ₹45,000 to ₹80,000 |
| Serverless GPU | ₹8,000 to ₹20,000, with 30 to 60 second cold starts |
| On-premise workstation GPU | ₹6 to 9 lakh capex, plus power and an owner |

Plus vLLM deployment, monitoring, an upgrade path, and someone on call. Against
₹350 a month on a hosted API that is roughly 130 times more expensive, and
break-even is somewhere north of 97,000 questions a month against Haiku. RUCHI
is expected to do 1,100.

Self-hosting is therefore not a cost decision. It is a data residency decision
and should be argued as one. Cheaper ways to get residency comfort, in order:

1. A hosted model in an Indian region. Google Cloud has Mumbai.
2. A zero-retention agreement, standard on enterprise API tiers. Combined with a
   regional endpoint this covers the realistic compliance ask.
3. Send less. Under this architecture the model sees the question and the result
   rows, never the database. Go further and have it see aggregates and row
   shapes with identifiers tokenised, resolving names client side after the
   answer returns. A model that never sees an employee name is a much shorter
   compliance conversation than any hosting arrangement, and it costs nothing.

Option 3 is worth designing in from the start. Recommend self-hosting only if
the client explicitly requires that no employee data touch a third party and
accepts the cost. If they do, self-hosted Qwen or DeepSeek runs this
architecture unchanged.

## Rollout

| Stage | Weeks | Contents |
| --- | --- | --- |
| 1 | 1 to 3 | RLS policies on leave, tasks, projects, users, tested against a restored production copy. Tier 1 tools for leave and tasks. Eval set built. No UI, tested through an API harness |
| 2 | 4 to 5 | Chat UI, streaming, tables. Project and vendor tools. Internal rollout to MD and EA only |
| 3 | 6 to 7 | Tier 2 scoped SQL behind a flag. Charts. Red team pass. Widen to HODs |
| 4 | after | Voice input, scheduled digests, proactive alerts. Only once the eval numbers hold for a month |

Ship stage 1 to two users and collect real questions. An eval set built from
guesses is wrong in ways only real usage exposes.

## Open questions for the client

- **Is attendance being built?** The headline example depends on it.
- **Should a HOD see outside their department here?** Our position is no, and
  the architecture enforces it. Changing that is a change to the product's
  permission model, not a setting in the assistant.
- **Does employee data leaving Indian infrastructure need sign-off, and from
  whom?**
- **Which twenty questions matter most?** That list is the scope, the eval set,
  and the demo script.
- **Who owns it after handover?** Determines how much of the tool catalog has to
  be configurable rather than code.

## Verify before any of this leaves the building

- Gemini and GPT current per-token pricing. Only the Claude figures here come
  from a dated source, 2026-06-24.
- Chinese hosted API pricing, if it stays on the table.
- Current GPU rental rates from a provider we would actually use.
- Live USD to INR. Everything above is at ₹90.
- The Postgres version on production, which decides the RLS policy syntax
  available.
