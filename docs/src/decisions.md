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
