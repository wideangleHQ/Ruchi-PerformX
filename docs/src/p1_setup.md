# Local setup

Two processes, one hosted database. You do not run PostgreSQL locally; both dev
and production point at Supabase. Ask the team lead for the connection string
before you start, because nothing works without it.

## Prerequisites

Node 20 or newer. Bun is used for lockfiles in both `server` and `client`
(`bun.lock` is committed), but the scripts run fine under npm. Pick one and
stay with it, because mixing package managers on the same lockfile causes
dependency drift that is annoying to debug.

You also need access to:

- The Supabase project (Postgres connection string, service role key, storage buckets)
- A Resend API key for outbound email
- The shared `JWT_SECRET` and `VMS_JWT_SECRET` values

## Server

```bash
cd server
bun install          # or npm install
npx prisma generate  # required before the first build
bun run dev          # nest start --watch on port 4000
```

`bun run dev` calls `npx kill-port 4000` first, so a stale process from a
previous run will not block you.

The API mounts everything under the global prefix `api/v1`. Local base URL is
`http://localhost:4000/api/v1`.

### Server environment

Create `server/.env`. Every variable below is read somewhere in
`server/src`, and several of them throw at boot if they are missing rather than
failing later.

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | Supabase Postgres connection string |
| `JWT_SECRET` | yes | Throws at module load in `auth.module.ts` if unset |
| `JWT_EXPIRES_IN` | no | Defaults to `24h` |
| `VMS_JWT_SECRET` | yes | Throws at import time in `vms-jwt.constants.ts` if unset |
| `VMS_JWT_EXPIRES_IN` | no | Defaults to `8h` |
| `PORT` | no | Defaults to `4000` |
| `INTERNAL_API_KEY` | yes | Shared secret CareerX sends as `x-internal-api-key` |
| `RESEND_API_KEY` | yes | Outbound email |
| `RESEND_FROM_EMAIL` | yes | Verified sender address |
| `SUPABASE_URL` | yes | Storage |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Storage, server side only |
| `SUPABASE_SERVICE_KEY` | see note | Older name still read in some files; set both to the same value |
| `SUPABASE_BUCKET` | yes | Task and self action attachments |
| `SUPABASE_VMS_BUCKET` | yes | Visitor photos |
| `SCORE_TIMEZONE` | no | Defaults to `Asia/Kolkata`, used for month boundaries in HOD scoring |
| `NODE_ENV` | no | Standard |

The two Supabase key names are a leftover from a rename that was never
finished. Setting both to the service role key is the safe move until the
duplicate is cleaned up.

Two of these secrets kill the process at startup rather than at first use:
`JWT_SECRET` is checked in the module body of `auth.module.ts`, and
`VMS_JWT_SECRET` is checked at the top level of
`common/constants/vms-jwt.constants.ts`. If the API exits immediately with no
useful stack trace, check those two first.

## Client

```bash
cd client
bun install
bun run dev          # next dev on port 4001
```

### Client environment

Create `client/.env.local`:

| Variable | Notes |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000/api/v1` |
| `NEXT_PUBLIC_SOCKET_URL` | `http://localhost:4000` (the gateway namespace is `/performx`) |
| `NEXT_PUBLIC_CAREER_API_URL` | CareerX API base, only needed if you are working on the career tab |
| `NEXT_PUBLIC_CAREER_APP_URL` | CareerX frontend base, used for the SSO redirect |

Port 4001 is not arbitrary. The server's CORS allowlist in `server/src/main.ts`
is hardcoded to `http://localhost:4001` and `https://app.ruchiperformx.in`. If
you run the client on any other port, every request fails CORS and the errors
in the browser console will not say why in an obvious way.

## Database

Prisma is configured with `provider = "postgresql"` and no `url` in
`schema.prisma`; the connection comes from `prisma.config.ts` reading
`DATABASE_URL`.

```bash
cd server
npx prisma generate    # regenerate the client after any schema edit
npx prisma db push     # push schema changes to the database
npx prisma studio      # browse data
```

There is no migrations directory in this repo. Schema changes have been applied
with `db push` and by hand through `prisma/sql/*.sql`. That is a real problem
for Phase 2 and is called out in [Known gaps](p1_known_gaps.md).

The schema also carries a lot of `/// This model contains row level security`
comments. Those are generated hints from `prisma db pull` telling you RLS
policies exist on the Supabase side. Prisma does not manage them. If a query
returns fewer rows than you expect and the SQL looks right, check the RLS
policy in the Supabase dashboard.

## Verifying the setup

Once both processes are up:

1. Open `http://localhost:4001/login`.
2. Sign in with a seeded account. Ask the team for credentials; there is no
   seed script in the repo.
3. Watch the server log for `RUCHI PerformX API running on port 4000` and, after
   login, a `Connected: <username> (<role>)` line from `NotificationsGateway`.
   The second line confirms the Socket.IO handshake worked.

If you see the first line but never the second, the socket URL or the JWT is
wrong. The gateway silently disconnects clients whose token fails to verify.

## Loose scripts in the server root

`server/` contains a pile of one-off scripts: `query.ts`, `verify.ts`,
`get_depts.ts`, `check-ea-pa.ts`, `check-latest.ts`, `dept-query.ts`,
`nest-query.ts`, `pg-query.js`, `query.sql`. They were written to debug
specific production incidents and are not part of the application. Do not
import from them and do not treat them as examples of house style. The same
applies to `client/update-api.js`, `update-api2.js`, `update-dialog.js`, and
`update-typo.js`, which were single-use codemods.
