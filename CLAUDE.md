# Working rules

Read `docs/src/p1_overview.md` before the code. `just docs` serves the handbook
on 3080.

## Write it the way a person would

Ponytail rules. The laziest thing that actually works, and nothing past that:

- Reuse before you write. The pattern is usually already in
  `server/src/modules`, and the helper you are about to write is often in
  `common/`.
- No abstraction with one caller, no config for a value that never changes, no
  scaffolding for a phase that has not started.
- Deletion before addition. Boring before clever.
- A deliberate shortcut gets a `ponytail:` comment naming the ceiling and the
  upgrade path, so simple reads as intent rather than ignorance.
- Modular here means the module shape in `docs/src/p1_conventions.md`: module,
  controller, service, dto, with the service talking to Prisma directly. No
  repository layer and no injection tokens outside `modules/vms/`, which has its
  own shape and keeps it.

Code that reads as machine written is not wanted, regardless of who or what
typed it:

- Comments that restate the line below them, or a step by step summary block at
  the top of a function.
- try/catch around code that cannot throw, null guards on values the types
  already guarantee.
- Three files where one function would do, or a name like `handleDataProcessing`.
- `as any` and `@ts-ignore` in place of fixing the type.
- Emoji anywhere in code, logs, comments, or commit messages.

## Document it

- Every exported service method, controller route, and shared util carries a doc
  comment saying what it does, what it throws, and what it assumes. Not a
  restatement of the body.
- Behaviour change means the handbook chapter changes in the same commit. Schema
  goes in `p1_data_model.md`, routes in `p1_api_reference.md`, anything about
  guards or roles in `p1_auth_and_roles.md`.
- A new environment variable goes in `server_env_required` in the justfile and
  in `p1_setup.md`, in the same commit. Both, or it fails quietly for the next
  person.
- A new DTO field means the matching zod schema in `client/src/lib/` changes too.
  `forbidNonWhitelisted` turns a mismatch into a 400 with an unhelpful message.
- `just docs-build` has to pass before you commit docs.

## Record the decision

`docs/src/decisions.md` is the log. Append an entry in the same commit as the
change whenever you pick between two reasonable options: schema shape, role
rules, notification or socket behaviour, a new dependency, a pattern other
modules will copy, or anything a future reader would otherwise have to reverse
engineer from a diff.

The format is at the top of that file. Skip the entry for renames, typo fixes,
and anything the diff explains on its own.

## Before you commit or push

- `just typecheck`, `just lint`, and `just routes` if you touched a controller.
  Guards are global here, so the risk is a missing `@Roles`, not a missing
  guard.
- `just no-ai-trails`. No AI attribution in code, docs, or commit messages, no
  `Co-Authored-By` line, no generated-with footer, no robot emoji. The
  pre-commit hook runs this, run it yourself before a push.
- Conventional commits. Scopes are listed in `docs/src/p1_conventions.md`.
- `graphify update .` after the code lands.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:

- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
