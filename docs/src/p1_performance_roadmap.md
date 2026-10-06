# Performance optimization roadmap

This chapter records the findings of the 2026-09-19 performance audit and the
four-phase plan for acting on them. It is the technical baseline: read it
before starting any of the phases below, and update it as each phase lands.

Everything under "Current findings" is verified against the code, in the same
spirit as [Known gaps](p1_known_gaps.md). Everything under "Planned" is a
proposal, not a description of what exists.

**Status: All four planned phases are done.** Phase 0 (documentation),
Phase 1 (storage & API performance), Phase 2 (pagination & query
optimization), Phase 3 (Redis introduction & shared caching), and Phase 4
(background processing & revalidation optimization) — see the
[Phase 1](#phase-1-implementation-record),
[Phase 2](#phase-2-implementation-record),
[Phase 3](#phase-3-implementation-record), and
[Phase 4](#phase-4-implementation-record) implementation records, and the
[Final performance review](#final-performance-review) table, below. No
BullMQ, workers, or queues exist anywhere in this codebase — Phase 4's audit
found neither monthly scoring nor escalation justified one at this
company's scale.

## Current findings

### Attachment signed URLs were generated sequentially — fixed in Phase 1

`attachments.service.ts` built each attachment's signed URL with a plain
`for` loop, awaiting `supabase.storage.from(bucket).createSignedUrl()` one
attachment at a time. This is called from task, self action, request, and
comment listing and detail views. A list of 20 rows with 3 attachments each was
up to 60 sequential external Storage round trips on one HTTP request. See the
implementation record below for what changed.

### Four endpoints had no pagination — fixed in Phase 2

`requests.findAll`, `tasks.getPending`, `tasks.getOverdue`, and the KPI list
(`kpi.service.ts`'s `list`, which used a hard `take: 200` cap rather than real
paging) returned unbounded or near-unbounded result sets. See the
[Phase 2 implementation record](#phase-2-implementation-record) below.

Correction to this chapter's own Phase 0 entry: it also claimed the Self
Actions frontend table rendered an unbounded array with no `page`/`limit`
sent. The Phase 2 audit found this was wrong — `self-actions-client.tsx`
already sent `page`/`limit`, already read `total`/`hasMore` back, and already
had working Previous/Next controls with URL-synced page state end to end,
matching the target shape this chapter describes for the other four
endpoints. Self Actions needed no Phase 2 work. The earlier finding looked at
`self-actions-table.tsx` (the row-rendering component) in isolation without
seeing that its parent page already paginates what it's given.

### The HOD score cache was not Redis — fixed in Phase 3

`common/services/redis.service.ts` was an in-process `Map` with a comment
admitting it simulated Redis because no Redis client was installed. There was
no `ioredis`/`redis` package, connection string, or network client anywhere
in the repository. Consequences at the time: the cache was per-process
(incoherent the moment more than one API instance ran), had no real eviction
beyond a lazy per-key TTL check, and was empty after every deploy. See the
[Phase 3 implementation record](#phase-3-implementation-record) below.

### Monthly scoring looped per employee, sequentially, with duplicate queries — fixed in Phase 4

`scoring.service.ts`'s `saveMonthlyScores` iterated every active employee in
a plain `for` loop. Each iteration called `calculateEmployeeScore` (four
sequential queries) plus three more counts and one upsert. The Phase 4 audit
found something the original finding hadn't: two of those three extra counts
(`completedTasks`, `selfActions`) used `where` clauses byte-for-byte
identical to two of the four queries `calculateEmployeeScore` had just run —
a genuine duplicate query, not just an unparallelized one. See the
[Phase 4 implementation record](#phase-4-implementation-record).

### The escalation engine is registered, contradicting `p1_known_gaps.md`

[Known gaps](p1_known_gaps.md) states `EscalationModule` is not in
`AppModule`'s `imports` array and the cron never runs. As of this audit,
`app.module.ts` imports and registers `EscalationModule`, with a comment
directly above the import that still says otherwise. Either code changed
without the docs (or the comment) being updated, or the reverse. This
mismatch has not been resolved — whoever owns this still needs to confirm
which is true in production.

Independent of that: the N+1 problem the known-gaps chapter describes — the
service looped over every overdue task and awaited a single-row
`createNotification()` per recipient — was fixed in Phase 1. The missing
`deleted_at: null` filter was fixed in Phase 4; see that record.

### Shared task creation looped per assignee inside one transaction — fixed in Phase 1

`tasks.service.ts`'s `createTaskRecords` looped over assignees for an
`EMPLOYEE_SHARED` task (up to `MAX_SHARED_ASSIGNEES = 50`), running four
sequential queries per assignee inside a single open `$transaction`. See the
implementation record below for what changed.

### Socket-triggered cache invalidation looked broader than the update — turned out to be dead code

`useSocket.ts` invalidates the `['tasks']` and `['dashboard']` TanStack Query
keys on `task:updated`, and `['polls']`/`['dashboard']` on `poll:updated`.
The Phase 4 audit traced every server-side emit site and found
`task:updated`/`task:comment:new` are never actually emitted anywhere in the
codebase — this finding described a client listener for an event the server
doesn't send. `poll:updated` is live and its invalidation is already
correctly scoped. See the [Phase 4 implementation record](#phase-4-implementation-record)
and the 2026-09-20 decision log entry.

### `DepartmentScopeService` was request-scoped — changed in Phase 4

It correctly cached its one department-scope lookup per request (keyed by
`user.sub`), so it cost exactly one extra query per scoped-role request, not
more. But `@Injectable({ scope: Scope.REQUEST })` forced every service that
depends on it — 13 of them — to also become request-scoped, so Nest
re-instantiated that whole provider subgraph on every request rather than
once at boot. See the [Phase 4 implementation record](#phase-4-implementation-record)
for what changed and how it was verified safe.

### Not the problem: the dashboard and the KPI/PS Score module

The dashboard endpoint already batches its roughly sixteen Prisma calls into
two parallel `Promise.all` blocks and uses raw SQL for the two set-based
lookups (birthdays, next holiday). Do not redesign it.

The KPI/PS Score module — the newest code, and the first suspect for a
"recently got slow" report — is the best-optimized part of the backend.
`psScoreFor` computes an entire KPI set's score with four total set-based
queries, not one per KPI or per user. The one real inefficiency,
`kpi_updates.findMany` fetching full update history instead of the latest
update per KPI, is already flagged in the code with a `ponytail:` comment
naming the ceiling. KPI detail (`findOne`) makes four sequential
`attachUsers()` calls that could be merged into one, but this only affects a
single-record view, not a list.

## Phase dependency map

```text
Phase 0                      Phase 1                     Phase 2
Documentation & baseline  →  Storage & API performance →  Pagination & query
(this chapter)               (attachment URLs,             optimization
                              notification batching,        (requests, pending/
                              shared task creation)          overdue tasks, self
                                                              actions, KPI list,
                                                              matching frontend
                                                              pagination)
        ↓                            ↓                              ↓
Phase 3                                                    Phase 4
Redis introduction         →                          →   Background jobs &
(shared cache, replaces                                    revalidation
the in-process Map)                                        (monthly scoring,
                                                             escalation, socket
                                                             invalidation,
                                                             DepartmentScopeService
                                                             review)
```

Redis is not a substitute for pagination, efficient SQL, batching, or correct
frontend caching. It is infrastructure for shared caching and, later,
background job processing — Phase 3 exists to support Phase 4, not to replace
Phases 1 and 2.

## Phase 1 — Storage & API performance

### Phase 1 implementation record

**Attachment signed URLs — Implemented, Verified.**
`AttachmentsService.mapAttachments` (`server/src/modules/attachments/attachments.service.ts`)
changed from a `for` loop awaiting `createSignedUrl` one attachment at a time
to `Promise.all` over the row, with a per-call `Map` that dedupes a storage
path signed more than once in the same row. Order is preserved because
`Promise.all` resolves in input order regardless of which signing call
finishes first. Error handling is unchanged: a failed signing call still falls
back to the stored `file_url` rather than throwing. No caching persists across
requests, and no authorization check changed — `ensureTaskVisible`,
`ensureRequestVisible`, `ensureSelfActionVisible`, and their comment
equivalents are untouched. Query count: unchanged (this was never a database
query — it's parallelizing external Supabase Storage calls); the win is wall
time, not statement count, and is not measured in this environment (no
Storage-latency instrumentation exists yet — see the Verification strategy
section).

**Notification batching — Implemented, Verified, one item Deferred.**
Two call sites replaced a per-recipient `createNotification()` with the
existing `notifyMany()`:
`EscalationService.runEscalationCheck` (`server/src/modules/escalation/escalation.service.ts`)
now collects every recipient across every overdue task into one array and
calls `notifyMany()` once, instead of one `createNotification()` per recipient
per task. `TasksService.dispatchTaskNotifications`
(`server/src/modules/tasks/tasks.service.ts`) now calls `notifyMany()` once
instead of `Promise.all`-wrapped individual `createNotification()` calls.
Recipient selection, notification type, title, and message are unchanged in
both call sites — only how they're persisted changed. One observable,
intentional side effect: both call sites now get the socket push and (for
`ESCALATION_MD`/`ESCALATION_HOD`, which were already configured for it in
`notification-channels.constants.ts`) the email dispatch that
`createNotification()` never triggered on its own. `TasksService`'s other
notification path, `createTaskNotificationsInTransaction`, was left
unchanged — it already batches via `db.notifications.createMany` and
deliberately skips the socket/email side effects because it runs inside a
transaction that might still roll back, matching the "notify after commit"
pattern already established elsewhere in this codebase (see the decision log).
**Deferred to Phase 4:** the escalation query's missing `deleted_at: null`
filter — a pre-existing correctness issue, not a batching one, and out of
Phase 1's scope.

**Shared task creation — Implemented, Verified.**
`TasksService.createTaskRecords`'s per-assignee loop (up to
`MAX_SHARED_ASSIGNEES = 50`) did four sequential writes per assignee:
`tasks.create`, `task_departments.createMany`, `task_status_logs.create`,
`audit_logs.create`. It's now four batched writes total, regardless of
assignee count: one `tasks.createManyAndReturn`, then
`task_departments.createMany`, `task_status_logs.createMany`, and
`audit_logs.createMany` built from its result. This relies on
`createManyAndReturn` preserving insert order — the same assumption
`NotificationsService.notifyMany` already makes (`rows[i]` paired with
`inputs[i]`), so it's an existing pattern in this codebase, not a new risk.
The transaction itself is untouched: all four statements still run
sequentially on the same `$transaction` client, since Prisma's interactive
transactions don't support concurrent queries on one connection — this was
checked before implementing, and it's why the fix batches writes rather than
parallelizing them with `Promise.all`. Duplicate-assignee rejection, the
50-assignee cap, and per-assignee department resolution (same department as
the creator collapses to one row; a different department keeps both) are all
unchanged.

Files changed: `server/src/modules/attachments/attachments.service.ts`,
`server/src/modules/escalation/escalation.service.ts`,
`server/src/modules/tasks/tasks.service.ts`.

Tests added: `server/src/modules/attachments/attachment-signing.spec.ts` (6
tests — empty list, single attachment, order preservation under
out-of-order resolution, path dedup, fallback on signing failure, an
attachment with no `storage_path`), `server/src/modules/escalation/escalation-batching.spec.ts`
(3 tests — one `notifyMany()` call across mixed employee/HOD/MD recipients,
one call with an empty list when nothing is overdue, the query shape),
`server/src/modules/tasks/shared-task-creation.spec.ts` (4 tests — one write
per table regardless of assignee count, correct per-task correlation back to
its assignee and audit log, correct per-assignee department rows, the
50-assignee cap still rejects before any write).

Tests executed: `npx vitest run` (full suite) — 287 of 288 pass. The one
failure, `kpi-scoring.spec.ts`'s "keeps a HOD out of approving the target they
set", is pre-existing and unrelated: it asserts against a role list that the
2026-09-18 decision "A HOD approves KPIs, but only in a department they head"
deliberately changed, and no file this phase touched is anywhere near it.

Build: `npm run build` (`prisma generate && nest build`) succeeds with no
errors. `npx tsc --noEmit -p tsconfig.json` (the project's `just typecheck`
step for the server) succeeds with no errors. `just boot-check` reports "App
starts. Every module has its guards in scope."

Known limitations: attachment signing wall-time savings are not measured in
this environment — there is no Storage-latency instrumentation to compare
before and after (see Verification strategy). The `createManyAndReturn`
order-preservation assumption, while already relied on elsewhere in this
codebase, has not been tested against a real Postgres instance with triggers
or partitioning that could theoretically reorder `RETURNING` rows; none exist
on the `tasks` table today.

Deferred to Phase 2: pagination for `requests.findAll`, `tasks.getPending`,
`tasks.getOverdue`, and the KPI list, and the matching frontend table
pagination. Deferred to Phase 3: Redis. Deferred to Phase 4: the escalation
query's `deleted_at: null` filter, monthly scoring's per-employee loop, socket
invalidation scoping, and the `DepartmentScopeService` request-scope review.

## Phase 2 — Pagination & query optimization

### Phase 2 implementation record

**Update after merging `main` (2026-10-06):** the KPI workflow commits rewrote
the KPI list. `KpiFilterDto` now declares its own `page`/`limit` and the list
returns `{ items, total, page, limit }`, not the shared `{ data, ... }` envelope
described here, so the KPI half of the Phase 2 pagination work below was
superseded by `main`'s version and my `kpi-list-pagination.spec.ts` was dropped.
Requests, pending tasks and overdue tasks still use the shared
`PaginationQueryDto` and `paginate()`.


**Pagination contract — Implemented.** Every endpoint in this phase returns
the same flat envelope `tasks.findAll` and `self-actions.findAll` already
used, not the `{data, meta: {...}}` shape once proposed above — that shape
was never real, and the flat one is already what the client's shared
`PaginatedResponse<T>` type and every existing paginated hook expect:

```json
{ "data": [], "total": 0, "page": 1, "limit": 20, "hasMore": false }
```

A new shared `PaginationQueryDto` (`server/src/common/dto/pagination-query.dto.ts`)
holds `page` (`@Min(1)`, default 1) and `limit` (`@Min(1) @Max(100)`, default
20) — the exact fields `TaskFilterDto` and `SelfActionFilterDto` already
declared inline, now written once. `RequestFilterDto` and `KpiFilterDto`
extend it; `tasks.getPending`/`getOverdue` take it directly, since neither had
any other filters to begin with. A new `paginate()` helper
(`server/src/common/helpers/pagination.helper.ts`) builds the envelope in one
place instead of a fourth, fifth, and sixth hand-written copy.

**Requests — Implemented, Verified.** `requests.findAll`
(`server/src/modules/requests/requests.service.ts`) now runs `count` and a
`skip`/`take` `findMany` in parallel, in the same order as every other
paginated endpoint: department scope resolved first, filters and
authorization folded into `where`, then count and page fetched together.
Attachment decoration (the Phase 1 fix) now runs only over the current page's
rows instead of the full result set — a second win layered on top of
pagination itself. Ordering gained an `id` tiebreaker alongside the existing
`created_at DESC`. All three existing filters (`status`, `type`, `taskId`)
and the authorization ordering are unchanged.

This is a breaking response-shape change (bare array to the envelope above),
so all three frontend consumers were updated: the Requests page, the Tasks
page's reassignment lookup, and the task detail page's reassignment check.
See "Frontend" below for how the Requests page itself handles it.

**Pending Tasks / Overdue Tasks — Implemented, Verified.**
`tasks.getPending`/`getOverdue` (`server/src/modules/tasks/tasks.service.ts`)
now take a `PaginationQueryDto` and paginate the same way, with an `id`
tiebreaker added alongside the existing `due_date ASC` sort (tasks routinely
share a due date — a batch assigned "end of day" — so this one was a real gap,
not a hypothetical one). The business definitions of "pending" (status
`REVIEWED`) and "overdue" (`due_date < now`, non-terminal status) are
untouched. Neither endpoint had a frontend consumer before this phase — the
only caller besides the controller was the PerformX Assistant's
`pending_tasks`/`overdue_tasks` tools (`assistant-tools.ts`), which now pass
`{ limit: 50 }` explicitly, matching the `task_list` tool's own existing
`limit: 50` convention, so the assistant keeps seeing a reasonably complete
view rather than being silently truncated to the new default of 20.

**KPI listing — Implemented, Verified.** `kpi.service.ts`'s `list` replaced
its `take: 200` hard cap with the same `skip`/`take` plus parallel `count`
pattern, with `id` added as a third tiebreaker after `period_start` and
`created_at`. `attachUsers` now enriches only the current page. KPI scoring,
PS Score, approval, and every other KPI business rule are untouched — this
phase changed the listing query only.

**Self Actions — No change needed.** The Phase 2 audit found the Phase 0
finding about this was wrong; see the correction under "Current findings"
above. Verified end to end, not modified.

**Frontend.** `client/src/api/requests.ts`'s `getRequests` and
`client/src/api/kpi.ts`'s `getKpis` now return `PaginatedResponse<T>`,
matching `tasksApi.getTasks` and `selfActionsApi.getSelfActions`. The KPI page
(`kpi-client.tsx`) gained page state and Previous/Next controls, identical in
shape to the ones `self-actions-client.tsx` already had. The Requests page
kept its existing two-section layout (general vs. reassignment requests,
derived by filtering one fetched page) and added the same Previous/Next
controls; the two summary badges ("Pending Approvals", "Reassignment
Requests") are backed by two additional `limit: 1` count-only queries against
the already-supported `status`/`type` filters, so they report an accurate
total across the whole table rather than just the current page. See the
2026-09-19 decision log entry for why, and the one limitation this leaves
(the two sections' visible contents can shift between pages in a way the
accurate badge totals don't).

**Query efficiency.** Beyond the pagination itself: Requests' attachment
decoration now runs per-page instead of per-entire-table (a second,
independent win from Phase 1's parallelization landing on a now-bounded
input). No new indexes were added — `tasks`, `task_requests`, and `kpis` were
already indexed on the columns these queries filter and sort by (see the
Phase 0 index audit); nothing in this phase's query shapes changed that.

Files changed: `server/src/common/dto/pagination-query.dto.ts` (new),
`server/src/common/helpers/pagination.helper.ts` (new),
`server/src/modules/requests/dto/request-filter.dto.ts`,
`server/src/modules/requests/requests.service.ts`,
`server/src/modules/tasks/tasks.service.ts`,
`server/src/modules/tasks/tasks.controller.ts`,
`server/src/modules/kpi/dto/kpi-query.dto.ts`,
`server/src/modules/kpi/kpi.service.ts`,
`server/src/modules/assistant/assistant-tools.ts`,
`client/src/api/requests.ts`, `client/src/api/kpi.ts`,
`client/app/(protected)/requests/page.tsx`,
`client/app/(protected)/tasks/page.tsx`,
`client/app/(protected)/tasks/[id]/page.tsx`,
`client/src/components/kpi/kpi-client.tsx`.

Tests added: `server/src/modules/requests/requests-pagination.spec.ts` (8),
`server/src/modules/tasks/pending-overdue-pagination.spec.ts` (10),
`server/src/modules/kpi/kpi-list-pagination.spec.ts` (8) — each covering
default page/limit, an explicit page, the count/`hasMore` math, an empty
page, business-rule preservation, the tiebreaker, and `PaginationQueryDto`'s
boundary validation (page 0, negative page, non-numeric page, limit above
100).

Tests executed: `npx vitest run` (full suite) — 313 of 314 pass. The one
failure is the same pre-existing, unrelated `kpi-scoring.spec.ts` case noted
in the Phase 1 record.

Build: `server`'s `npm run build` and `npx tsc --noEmit` both succeed.
`client`'s `npx tsc --noEmit` succeeds (after clearing a stale generated
`.next/dev/types` artifact unrelated to this phase) and `bun run build`
(the real Next.js production build) succeeds, producing all 47 routes.
`just boot-check` reports "App starts. Every module has its guards in
scope." `just lint` could not run — `eslint` is not an installed dependency
in this environment, a pre-existing gap this phase did not introduce (see
[Known gaps](p1_known_gaps.md)).

Known limitations: the Requests page's "Task Requests" and "Reassignment
Requests" sections are derived from one paginated fetch, so a request's
visible section can shift between page loads even though the two summary
badges' totals are accurate (documented in the decision log). Storage/DB
latency before-and-after numbers are not measured in this environment, same
caveat as Phase 1.

Deferred to Phase 3: Redis — untouched, not installed, not configured.
Deferred to Phase 4: monthly scoring, the escalation query's `deleted_at`
filter, socket invalidation scoping, `DepartmentScopeService` review. A
possible future Phase 2 follow-up, not implemented here: splitting the
Requests page's general/reassignment sections into two independently
paginated queries, which needs an "exclude type" filter the API does not
have today.

## Phase 3 — Redis introduction

### Phase 3 implementation record

**Redis infrastructure — Implemented, Verified (mocked; no live instance available).**
`common/services/redis.service.ts` — the same file, same class name, same
`get`/`set`/`del` signatures the in-memory version had — now wraps `ioredis`
instead of a `Map`. `exists()` was added as the one new method (matching the
architecture sketch this chapter proposed); `getJson`/`setJson` were
evaluated and not added, since `get`/`set` already round-trip JSON (see the
2026-09-19 decision log entry). `CommonModule` needed no changes — it already
provided and exported `RedisService` globally.

`REDIS_URL` unset means the client is never constructed at all, not a
`localhost:6379` fallback: `onModuleInit` checks the env var directly, logs
one warning, and every method short-circuits to a miss/no-op before touching
`ioredis`. `REDIS_URL` set gets `lazyConnect`, a 5s connect timeout,
`maxRetriesPerRequest: 1`, `enableOfflineQueue: false` (no unbounded command
buffering during an outage), and a capped backoff (`min(attempt * 200ms,
2000ms)`) — bounded, not infinite-immediate, retrying. TLS is whatever the
`rediss://` scheme in the URL itself asks for; nothing here constructs manual
TLS options. `main.ts` now calls `app.enableShutdownHooks()`, which is what
makes `RedisService.onModuleDestroy`'s `client.quit()` — and
`PrismaService.onModuleDestroy`'s existing, previously-dead `$disconnect()`
— actually run on `SIGTERM`/`SIGINT` rather than never firing (see the
2026-09-19 decision log entry; this is a small change with an
application-wide effect, not scoped to Redis alone).

`ioredis` was chosen over porting CareerX's existing hand-rolled,
zero-dependency RESP-over-TCP client (`CareerX/server/src/redis/redis.service.ts`,
found during the audit) specifically because that client has no reconnect
backoff — a failed command just opens a fresh TCP connection on the very next
call, for as long as Redis stays down, which is the "hammer an unavailable
server" failure mode this phase was told to avoid. See the decision log for
the full reasoning, including why this makes Phase 4's eventual BullMQ
adoption (which requires ioredis) not need a second client later.

**HOD score cache — Implemented, Verified.** `hod-score.service.ts` required
zero call-site changes — `this.redis.get<HodScoreRecord[]>(key)`,
`this.redis.set(key, records, HOD_SCORE_CACHE_TTL_SECONDS)`, and
`this.redis.del(key)` are exactly what it called against the old `Map`. One
change was made beyond the swap itself: `getMatrix` now `.catch(() => null)`s
the `get()` and `.catch(() => undefined)`s the `set()` directly, rather than
relying solely on `RedisService`'s own internal error handling — belt and
suspenders on the "Redis failure must not become a single point of failure"
requirement, matching the same pattern applied to attachment caching below.
Key format (`hod-score:{version}:{year}:{month}`), 30 minute TTL, and the
version-bump invalidation strategy are all unchanged — they were already
correct, just backed by a `Map` instead of Redis. `invalidatePeriod()` still
exists and still has no caller anywhere in the codebase (confirmed by
search); TTL alone governs freshness in practice today, exactly as it did
before this phase, and no new invalidation trigger was invented.

**Attachment signed URL cache — Implemented, Verified.** The Phase 3 safety
review's five conditions were checked against the actual code, not assumed,
and all five held (see the decision log entry for each one). `signedUrlFor`
now checks `performx:attachment-url:{sha256(storagePath)}` before calling
Supabase, with a 45 minute Redis TTL against the signed URL's own 60 minute
lifetime (both now named constants, `ATTACHMENT_URL_CACHE_TTL_SECONDS` and
`SIGNED_URL_TTL_SECONDS`, where a magic `60 * 60` sat before). The Phase 1
improvements are untouched: `Promise.all` ordering, the per-call in-memory
dedup Map, and the fall-back-to-stored-URL-on-failure behavior all still
work exactly as before — the Redis lookup sits inside the same `sign()`
closure Phase 1 already built, wrapped so a Redis failure on either read or
write falls through to Supabase rather than breaking attachment display.
Authorization is unaffected: every `ensureXVisible` check still runs before
`signedUrlFor` is ever reached, and only the already-authorized signed URL
is cached — never an access decision.

**No broad response caching, no pagination cache, no BullMQ.** None of the
three were implemented, matching the phase's explicit scope: pagination
already solved the Tasks/Requests/Self Actions/KPI list problem in Phase 2,
and background jobs are Phase 4.

**Environment.** `REDIS_URL` added to the environment table in
[Local setup](p1_setup.md), documented as optional with the same "unset
cannot fail quietly" framing already used for `CORS_ORIGINS` — deliberately
**not** added to `server_env_required`, since that list is for variables
whose absence should be loud, and a missing `REDIS_URL` already logs a clear
warning and degrades correctly rather than failing quietly. No `.env.example`
exists in this repository to update (the environment table is the
documented source of truth).

**Health check.** No health-check endpoint exists anywhere in this project —
`just health` curls the dashboard endpoint as a proxy, not a dedicated health
route (confirmed by search: no `@nestjs/terminus`, no `HealthCheck` usage).
There is nothing to represent Redis's status in, so nothing was added or
changed here.

Files changed: `server/src/common/services/redis.service.ts`,
`server/src/main.ts`, `server/src/modules/attachments/attachments.service.ts`,
`server/src/modules/hod-score/hod-score.service.ts`,
`server/package.json`, `server/bun.lock` (new dependency: `ioredis`),
`docs/src/p1_setup.md`.

Tests added: `server/src/common/services/redis.service.spec.ts` (13 tests —
the REDIS_URL-unset path exercised for real with no mocking needed; the
REDIS_URL-set path against a mocked `ioredis` client, covering connection
options, JSON round-tripping, a missing key, a malformed cached value, and a
client error on each of get/set/del/exists all resolving rather than
throwing), `server/src/modules/hod-score/hod-score-cache.spec.ts` (7 tests —
miss-then-cache, hit-skips-recompute, distinct keys per period, Redis
read/write failure fallback, `invalidatePeriod` for the current and an
explicit period), and 3 new tests added to
`server/src/modules/attachments/attachment-signing.spec.ts` (cache hit
across two independent calls, the cache key/TTL shape, Redis read/write
failure fallback) alongside the 7 already there from Phase 1.

**Live Redis integration could not be verified** — no approved Redis
instance was available in this environment, per the phase's own instruction
not to connect to an unknown instance. Everything Redis-shaped is covered by
mocking `ioredis` directly rather than skipped.

Tests executed: `npx vitest run` (full suite) — 337 of 338 pass. The one
failure is the same pre-existing, unrelated `kpi-scoring.spec.ts` case noted
in the Phase 1 and Phase 2 records.

Build: `server`'s `npm run build` and `npx tsc --noEmit` both succeed.
`just boot-check` reports "App starts. Every module has its guards in
scope," confirmed both with `REDIS_URL` unset (the warning log appears,
nothing else changes) and, separately, with a manual boot showing the same
clean startup sequence.

Known limitations: graceful shutdown (`onModuleDestroy` → `client.quit()`)
is implemented and unit-tested, but live end-to-end `SIGTERM` delivery could
not be observed in this environment — Git Bash on Windows does not reliably
deliver POSIX signals to a native Node process the way a Railway Linux
container does on a real deploy or restart. Cache hit-rate and Storage-call
reduction from attachment caching are not measured in this environment —
`Not measured in current environment`, same caveat as Phases 1 and 2.

Deferred to Phase 4: BullMQ, background workers, queue processors, monthly
scoring's per-employee loop, the escalation query's `deleted_at` filter,
socket invalidation scoping, and the `DepartmentScopeService` request-scope
review.

## Phase 4 — Background jobs & revalidation optimization

### Phase 4 implementation record

This phase re-audited every one of its five targets against the code as it
stood after Phases 1–3, rather than assuming the original findings still
held. Two of the five (escalation's notification batching, and part of its
`deleted_at` gap) had already been addressed in Phase 1; one (socket
invalidation) turned out to describe dead code, not live behavior. What
follows is what was actually found and actually changed.

**Monthly scoring — Implemented, Verified.**
`ScoringService.saveMonthlyScores`'s per-employee loop had a genuine
duplicate-query bug beyond the sequential-awaits shape noted in Phase 0: it
ran `completedTasks` and `selfActions` counts once inside
`calculateEmployeeScore` for the score math, then ran the *same two queries
again*, byte-for-byte identical `where` clauses, to get the values it
persists as columns. A new private `scoreComponents()` runs the four
score-math reads in parallel via `Promise.all` and returns
`completedTasks`/`selfActions` alongside the score, so `saveMonthlyScores`
computes each once and shares it. Employees are now processed in batches of
10 (`Promise.all` per batch) instead of one fully sequential `for` loop, cutting
per-employee round trips from roughly 8 mostly-sequential queries to 4
parallel ones plus 1 write. The persisted `overdue_tasks_count` deliberately
stays a separate, all-time-scoped query — not merged with the period-scoped
overdue read the score uses — because that mismatch is `known_gaps.md`'s
already-documented, separately-tracked correctness issue, not something a
performance phase should fix as a side effect. `calculateEmployeeScore`'s
public signature and return value are unchanged; `calculateDepartmentScore`
was found to have zero callers anywhere in the codebase (dead code) and was
left alone. Error isolation is unchanged: one employee's write failure still
fails the whole batch and the whole job, exactly as the original sequential
loop did — not fixed, not worsened, per the phase's own instruction not to
change that semantic silently.

**Monthly scoring — queue decision: stays a cron.** See the 2026-09-20
decision log entry. Not genuinely long-running once the duplicate queries
are gone (seconds, not minutes, at this company's headcount), never coupled
to a user-facing response, and this repository has no worker deployment
topology to introduce for a job this short.

**Escalation — Implemented, Verified (one item was already done in Phase 1).**
Notification batching via `notifyMany()` was already completed in Phase 1
(see that record) — re-verified still in place, not re-implemented. What
Phase 4 actually added: the missing `deleted_at: null` filter on the
overdue-tasks query, matching every other tasks query in the codebase. A
regression test (`escalation-batching.spec.ts`) now asserts the filter is
present. Lightweight observability was added: the sweep logs the overdue
task count and notification count it produced, and the cron logs its own
duration.

**Escalation — queue decision: stays a cron.** Same reasoning as monthly
scoring — a handful of overdue tasks and recipients per day at this
company's scale is not a workload a queue would meaningfully improve, and
introducing one would add a failure mode and an idempotency design this job
does not currently need.

**Redis-backed background jobs — Not implemented, and not justified.**
Section 3's own instruction was "do not add a queue simply to satisfy the
architecture" — after auditing both cron jobs, neither cleared the bar for
one. No BullMQ or other queue library was added; `server/package.json` and
`bun.lock` were not touched this phase (the only dependency change in this
whole roadmap remains Phase 3's `ioredis`).

**Socket invalidation — Audited, not changed; the finding it was based on is
outdated.** Tracing every server-side emit site (not just the frontend
listeners) found that `task:updated`/`task:comment:new` — the events behind
the "broad `['tasks']`/`['dashboard']` invalidation" finding this chapter
carried since Phase 0 — are defined on the gateway but have zero callers
anywhere in the server. Nothing ever emits them. The frontend's `comment:new`
listener doesn't even match a real event name (the gateway emits
`task:comment:new`). The only two socket events that are actually live and
trigger invalidation today are `notification:new` (already scoped to
`['notifications']`) and `poll:updated` (company-wide, invalidating
`['polls']` and `['dashboard']` — both genuinely affected, since polls are
embedded directly in the dashboard payload). There is no live over-broad
invalidation left to narrow; see the 2026-09-20 decision log entry. No
frontend files were changed.

**`DepartmentScopeService` — Implemented, Verified, with authorization
regression tests.** Converted from `@Injectable({ scope: Scope.REQUEST })`
with a `Map<string, DepartmentScope>` keyed by `user.sub`, to a plain
singleton with a `WeakMap<JwtPayload, DepartmentScope>` keyed by the
request's own decoded JWT object. This was verified safe before
implementing, not assumed: `JwtAuthGuard` calls `jwtService.verify()` once
per request, which returns a fresh object every call, and `@CurrentUser()`
always returns that exact same reference to every service in the request —
so a `WeakMap` on that identity reproduces the "resolve once per request"
guarantee the old request-scoped instance gave, without forcing the 13
services that inject this one into request scope too. All five methods
(`resolveDepartmentScope`, `computeDepartmentScope`, `validateDepartmentAccess`,
`hasAnyDepartmentAccess`, and the four role-branch resolvers) are otherwise
byte-for-byte unchanged — this was a scope-and-cache-key change only, not an
authorization logic change. 16 regression tests
(`department-scope.service.spec.ts`) cover every role's resolution, both
authorization helper methods, and — the specific thing this refactor had to
get right — that two different request's user objects for the same person
never share a cached scope, and concurrent requests for different users
resolve correctly against the one shared singleton instance.

**Performance observability — Implemented, lightweight.** Both crons
(`ScoringCron`, `EscalationCron`) now log their own wall-clock duration.
`ScoringService` logs the employee count processed; `EscalationService`
logs the overdue task count and notification count produced. No metrics
platform, no new logging library — the same `Logger` calls these files
already used, extended with one more number each.

Files changed: `server/src/common/services/department-scope.service.ts`,
`server/src/modules/scoring/scoring.service.ts`,
`server/src/modules/scoring/scoring.cron.ts`,
`server/src/modules/escalation/escalation.service.ts`,
`server/src/modules/escalation/escalation.cron.ts`.

Tests added: `server/src/common/services/department-scope.service.spec.ts`
(16 tests — every role's resolution, both authorization helpers, the
per-request WeakMap caching guarantee, and concurrent-request isolation),
`server/src/modules/scoring/scoring-batch.spec.ts` (6 tests — no duplicate
completedTasks/selfActions queries, one upsert per employee, correctness
across multiple batches, the overdue-count query staying separately scoped,
one-employee-failure-fails-the-job preserved, `calculateEmployeeScore`'s
return contract preserved), and one test added to
`escalation-batching.spec.ts` (the new `deleted_at: null` filter).

Tests executed: `npx vitest run` (full suite) — 360 of 361 pass. The one
failure is the same pre-existing, unrelated `kpi-scoring.spec.ts` case noted
in every prior phase's record.

Build: `server`'s `npm run build` and `npx tsc --noEmit` both succeed;
`client`'s `npx tsc --noEmit` succeeds (no client files changed this phase).
`just boot-check` reports "App starts. Every module has its guards in
scope." `just lint` remains not runnable in this environment (`eslint` is
not an installed dependency — pre-existing, unrelated to this phase, noted
in every prior phase's record too).

Redis verification: the full test suite run above includes
`redis.service.spec.ts`, `hod-score-cache.spec.ts`, and the attachment
cache tests in `attachment-signing.spec.ts` — all still passing, confirming
Phase 3's cache behavior is intact. Nothing in this phase touched
`redis.service.ts`, `hod-score.service.ts`'s cache usage, or
`attachments.service.ts`'s cache usage.

Known limitations: cron duration numbers are now logged but not measured
against a production baseline in this environment — `Not measured in
current environment`, same caveat as every prior phase. `calculateDepartmentScore`
remains dead code (zero callers); it was not removed, since deleting it is a
cleanup decision outside a performance phase's mandate, not a performance
fix.

Deferred: nothing was deferred to a future phase — this is the last planned
phase in the roadmap. Two items remain open by deliberate decision, not by
omission: the `overdue_tasks_count` all-time-vs-monthly mismatch (tracked in
[Known gaps](p1_known_gaps.md), not a performance issue), and whether
`task:updated`/`comment:new` should ever be wired up as live socket events
(a product decision, not something this roadmap resolves).

### Final performance review

| Original Finding | Phase | Current Status | Verification |
| --- | --- | --- | --- |
| Sequential attachment signed URLs | 1 | Completed | Tests |
| Sequential shared task creation writes | 1 | Completed | Tests |
| Unbatched task/escalation notifications | 1 | Completed | Tests |
| Missing pagination (Requests, Pending/Overdue Tasks, KPI list) | 2 | Completed | Tests |
| Self Actions pagination | n/a | Already correct before Phase 2 | Tests (pre-existing) |
| In-process cache masquerading as Redis | 3 | Completed | Tests (mocked `ioredis`; no live instance available) |
| Attachment URL caching | 3 | Completed | Tests |
| Monthly scoring's duplicate queries and sequential loop | 4 | Completed | Tests |
| Escalation missing `deleted_at` filter | 4 | Completed | Tests |
| Broad socket invalidation on `task:updated`/`poll:updated` | 4 | Not applicable — `task:updated` is dead code, never emitted; `poll:updated`'s invalidation is already correctly scoped | Code audit (grep for every emit site) |
| Request-scoped `DepartmentScopeService` | 4 | Completed | Tests |

No performance improvement numbers are claimed anywhere in this table beyond
what the query-shape and test evidence directly supports; wall-clock
before/after timings were not measured in this environment for any phase.

## Implementation principles

1. **Preserve business logic.** Permissions, roles, task behavior, KPI/PS
   Score/AT Score calculations, approval workflows, notification semantics,
   and authorization do not change as a side effect of performance work
   unless a decision log entry says otherwise.
2. **Measure before rewriting architecture.** A theoretical inefficiency is
   not by itself a reason to redesign something that works.
3. **Optimize the bottleneck**, prioritizing measurable user-facing latency
   over what looks inefficient in isolation.
4. **Avoid premature caching.** Cache only data with a clear invalidation or
   TTL strategy in mind before it's added.
5. **Preserve API compatibility.** Existing contracts hold unless a phase's
   entry documents a migration.
6. **Ship phases incrementally**: implemented, tested, built, deployed,
   verified, before the next phase starts.

## Risk and safety notes

A Redis outage must not take down operations that don't need Redis. Every
cached dataset needs an explicit invalidation or TTL strategy before it's
cached — not after. A cache must never bypass attachment authorization: a
cached signed URL is still subject to the same access check a fresh one would
get. Query optimization does not mean replacing a correct database query with
cache-dependent behavior that can go stale. No phase runs
`prisma migrate reset` or any destructive database operation as part of
performance work. No phase introduces a breaking API change without a
decision log entry describing the migration.

## Verification strategy

Each phase compares, before and after: API response time, database query
count, external Storage call count, response payload size, frontend render
workload, and cache hit/miss rate where a cache is involved. Numbers that
haven't been measured yet are marked `Not yet measured`, not estimated.

## Current vs. target

| Area | Current | Target | Phase |
| --- | --- | --- | --- |
| Attachment URLs | ~~Sequential generation~~ Done: parallelized with per-row dedup | Persistent cache, if ever needed | 1 (done) |
| Shared task creation | ~~4 writes × N assignees~~ Done: 4 batched writes total | — | 1 (done) |
| Task-creation & escalation notifications | ~~Per-recipient inserts~~ Done: batched via `notifyMany` | — | 1 (done) |
| Requests list | ~~Unbounded~~ Done: paginated, `id` tiebreaker | — | 2 (done) |
| Pending tasks | ~~Unbounded~~ Done: paginated, `id` tiebreaker | — | 2 (done) |
| Overdue tasks | ~~Unbounded~~ Done: paginated, `id` tiebreaker | — | 2 (done) |
| KPI list | ~~Hard `take: 200` cap~~ Done: real pagination | — | 2 (done) |
| Self Actions | Already paginated end to end before this phase | — | n/a |
| HOD score cache | ~~In-process `Map`~~ Done: `ioredis`-backed, unchanged key/TTL | — | 3 (done) |
| Attachment cache | ~~None~~ Done: Redis, 45min TTL under a 60min signed URL | — | 3 (done) |
| Monthly scoring | ~~Sequential loop, duplicate queries~~ Done: parallel + deduped + batched | — | 4 (done) |
| Escalation query | ~~Missing `deleted_at: null` filter~~ Done: filter added | — | 4 (done) |
| Socket invalidation | Assumed company-wide | Audited: `task:updated` is dead code; `poll:updated` already correctly scoped | 4 (done, no change needed) |
| `DepartmentScopeService` | ~~Request-scoped, 13 dependents~~ Done: singleton + `WeakMap` | — | 4 (done) |

## Success criteria

Phase 0: findings documented, roadmap written, no application code touched.

Phase 1: **Done.** Attachment URL generation parallelized; notification
insertion and shared task creation reviewed and optimized; authorization and
API behavior verified unchanged; tests added and passing; build and
`boot-check` green. See the implementation record above.

Phase 2: **Done.** Requests, pending tasks, overdue tasks, and KPI list all
paginated server-side; frontend pagination wired to match; no remaining
unbounded `.map()` render on these views; self actions confirmed already
compliant; tests added and passing; build, typecheck, and `boot-check` green.
See the implementation record above.

Phase 3: **Done.** Real Redis (`ioredis`) in place; `RedisService` backed by
an actual client with bounded retry and no offline-queue growth; HOD score
cache migrated with unchanged keys/TTL/semantics; attachment signed URLs
cached after a five-condition safety review that passed; TTL strategy
documented for both; no production localhost fallback; Redis read/write
failure verified (unit tests) not to break the HOD score or attachment
response; no BullMQ, no broad response caching, no pagination cache; tests
added and passing; build and `boot-check` green. See the implementation
record above.

Phase 4: **Done.** Monthly scoring's duplicate queries removed and its
per-employee reads parallelized and batched, without changing scoring
semantics; escalation's `deleted_at` filter added; background job adoption
evaluated and found not justified for either cron at this scale;
socket invalidation audited (found already correct, no change needed);
`DepartmentScopeService` converted to a singleton with authorization
regression tests; lightweight cron observability added; tests added and
passing; build, typecheck, and `boot-check` green. See the implementation
record and the [Final performance review](#final-performance-review) table
above.

All four planned phases of this roadmap are now complete.
