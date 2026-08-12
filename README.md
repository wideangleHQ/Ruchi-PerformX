# RUCHI PerformX

Internal execution and performance platform for Ruchi Foodline Pvt Ltd. Task
assignment, self-initiated work tracking, cross-department transfers, employee
requests, performance scoring, and visitor management, for around 100 users.

NestJS API plus a Next.js client against PostgreSQL on Supabase. The companion
repository is `CareerX`, the recruitment portal, which uses PerformX as its
identity provider.

Phase 1 is deployed. Phase 2 is scoped and documented but not started.

## Read the handbook first

Everything about this codebase is written down. Do not go spelunking:

```bash
just docs
```

That serves the engineering handbook at <http://localhost:3080>. Start with
"Start here", then "Local setup", then "Architecture".

If you only have five minutes, read `docs/src/p1_known_gaps.md`. It lists the
places where the code does something surprising, and it will save you a
debugging session.

## Quick start

You need Node 20 or newer, [`just`](https://github.com/casey/just), and `bun`
or `npm`. You also need the Supabase connection string and the shared secrets;
ask the team lead before you start, because nothing runs without them.

```bash
just setup     # install deps, generate the Prisma client, check your env files
just dev       # run the API on 4000 and the client on 4001
```

Open <http://localhost:4001/login>.

`just setup` fails loudly if an environment variable is missing. That is
deliberate: two of the secrets kill the process at import time with no useful
stack trace, so it is better to catch them before boot.
`docs/src/p1_setup.md` explains what each one is for.

## Everything just can do

Run `just` with no arguments for the live list. The short version:

### Setting up

| Command | What it does |
| --- | --- |
| `just setup` | Install, generate the Prisma client, check the environment |
| `just install` | Dependencies in `server` and `client` |
| `just check-env` | Report missing environment variables and stop |

### Running

| Command | What it does |
| --- | --- |
| `just dev` | API and client together, Ctrl-C stops both |
| `just dev-server` | API only, watch mode, port 4000 |
| `just dev-client` | Client only, port 4001 |
| `just kill-ports` | Free 4000 and 4001 after a crashed run |
| `just health` | Is the API answering? |

### Building

| Command | What it does |
| --- | --- |
| `just build` | Build both for production |
| `just build-server` | API only, runs `prisma generate` first |
| `just build-client` | Client only |
| `just start-server` | Run the built API |
| `just start-client` | Run the built client |
| `just clean` | Remove `dist`, `.next`, and the built handbook |

### Database

| Command | What it does |
| --- | --- |
| `just db-generate` | Regenerate the Prisma client, needed after every schema edit |
| `just db-push` | Push schema changes to the database |
| `just db-studio` | Browse the data in Prisma Studio |
| `just db-models` | List every model and enum with line numbers |

### Docs

| Command | What it does |
| --- | --- |
| `just docs` | Serve the handbook on 3080 with live reload |
| `just docs-build` | Build it to `docs/book` |

### Checking

| Command | What it does |
| --- | --- |
| `just lint` | Lint the client. The server has no linter configured |
| `just typecheck` | Type check both without emitting |
| `just routes` | Print every API route with its role decorators |

`just routes` is the fastest way to answer "what endpoints exist and who can
call them" without opening fifteen controller files.

### Using npm instead of bun

Both are fine, but pick one and stay with it, because mixing them on the same
lockfile causes dependency drift.

```bash
just pm=npm install
just pm=npm dev
```

## Layout

```
server/          NestJS API, port 4000, global prefix /api/v1
  src/modules/   one directory per feature
  src/common/    guards, decorators, shared services
  prisma/        schema.prisma
client/          Next.js 16, port 4001
  app/           (public), (protected), and vms route groups
  src/api/       one axios module per backend domain
  src/hooks/     TanStack Query wrappers
docs/            mdbook handbook, the p1_ and p2_ chapters
```

## Things that will trip you up

The client port is not negotiable. The API CORS allowlist in `server/src/main.ts`
is hardcoded to `localhost:4001`. Run the client anywhere else and every request
fails CORS without saying why.

The API exits at startup if `JWT_SECRET` or `VMS_JWT_SECRET` are missing. Both
are checked at module import time, so you get an exit with no stack trace.
`just check-env` catches this.

There are no migrations. Schema changes have been applied with `prisma db push`,
which records no history and has no rollback. Phase 2 adds roughly twenty tables,
so establishing migrations is the first task of that phase. See
`docs/src/p2_data_model.md`.

The escalation module is written but never imported into `AppModule`, so its
cron has never run. Nothing has ever been escalated for being overdue. See
`docs/src/p1_known_gaps.md`.

There are no tests, no linter config on the server, and no CI. Do not assume a
change is safe because it built.

The loose scripts in `server/` (`query.ts`, `verify.ts`, `check-latest.ts`, and
friends) are one-off debugging tools, not examples of house style. Same for
`client/update-api.js` and its siblings.

## Contributing

Commit messages in the existing history are inconsistent. Do not copy them.
Use conventional commits:

```
feat(leave): add leave balance calculation
fix(tasks): correct reviewed_at timestamp on close
docs(p2): add projects module spec
```

Scopes: `auth`, `tasks`, `self-actions`, `requests`, `transfers`, `scoring`,
`hod-score`, `notifications`, `vms`, `client`, `schema`, `docs`.

Conventions worth knowing before your first pull request are in
`docs/src/p1_conventions.md`. The one that catches people: the global
`ValidationPipe` runs with `forbidNonWhitelisted`, so adding a field to a form
without adding it to the DTO returns a 400 rather than being ignored.
