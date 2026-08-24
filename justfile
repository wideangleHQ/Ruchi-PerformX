# RUCHI PerformX
#
# Run `just` with no arguments to see everything.
# Docs: `just docs` then open http://localhost:3080

# Package manager. Override per invocation: `just pm=npm install`
pm := "bun"

shadow_container := "pfx-shadow"
shadow_port := "55432"
shadow_url := "postgresql://postgres:shadow@localhost:" + shadow_port + "/shadow"
shadow_diff_url := "postgresql://postgres:shadow@localhost:" + shadow_port + "/shadow_diff"

# Server listens here, client listens on SERVER_PORT + 1.
# The API CORS allowlist is hardcoded to localhost:4001, so do not move the client.
server_port := "4000"
client_port := "4001"

# Required environment variables, checked by `just check-env`.
# JWT_SECRET, VMS_JWT_SECRET and ASSET_ENCRYPTION_KEY kill the process at import
# time when missing.
server_env_required := "DATABASE_URL DIRECT_URL JWT_SECRET VMS_JWT_SECRET ASSET_ENCRYPTION_KEY OPENCODE_API_KEY INTERNAL_API_KEY RESEND_API_KEY RESEND_FROM_EMAIL SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY SUPABASE_BUCKET SUPABASE_VMS_BUCKET"
client_env_required := "NEXT_PUBLIC_API_URL NEXT_PUBLIC_SOCKET_URL"

# Show all recipes
default:
    @just --list --unsorted

# ---------------------------------------------------------------- getting set up

# Day one: install everything, generate the Prisma client, check your env files
setup: install db-generate
    @just check-env
    @echo ""
    @echo "Setup done. Start both processes with: just dev"

# Install dependencies in server and client
install:
    cd server && {{pm}} install
    cd client && {{pm}} install

# Warn about missing environment variables before they crash something
check-env:
    #!/usr/bin/env bash
    missing=0
    for f in server client; do
        env_file="$f/.env"
        [ "$f" = "client" ] && env_file="client/.env.local"
        if [ ! -f "$env_file" ]; then
            echo "MISSING FILE  $env_file"
            missing=1
            continue
        fi
        required="{{server_env_required}}"
        [ "$f" = "client" ] && required="{{client_env_required}}"
        for key in $required; do
            if ! grep -qE "^\s*${key}=..*" "$env_file"; then
                echo "MISSING VAR   $env_file  $key"
                missing=1
            fi
        done
    done
    if [ "$missing" -eq 0 ]; then
        echo "Environment looks complete."
    else
        echo ""
        echo "See docs/src/p1_setup.md for what each variable is for."
        exit 1
    fi

# ---------------------------------------------------------------- running

# Run the API and the client together. Ctrl-C stops both.
dev:
    #!/usr/bin/env bash
    set -euo pipefail
    trap 'kill 0' EXIT
    just dev-server &
    just dev-client &
    wait

# API only, watch mode, port 4000
dev-server:
    cd server && {{pm}} run dev

# Client only, port 4001
dev-client:
    cd client && {{pm}} run dev

# Free both ports when a previous run left something behind
kill-ports:
    -npx kill-port {{server_port}} {{client_port}}

# ---------------------------------------------------------------- building

# Build both for production
build: build-server build-client

# Build the API (runs prisma generate first)
build-server:
    cd server && {{pm}} run build

# Build the client
build-client:
    cd client && {{pm}} run build

# Run the built API
start-server:
    cd server && {{pm}} run start

# Run the built client
start-client:
    cd client && {{pm}} run start

# Delete build output and generated files
clean:
    rm -rf server/dist client/.next docs/book

# ---------------------------------------------------------------- database

# Regenerate the Prisma client. Run this after every schema edit.
db-generate:
    cd server && npx prisma generate

# Superseded by migrations. Kept because the schema was maintained this way
# until 2026-08-16 and old habits need somewhere to fail loudly.
db-push:
    #!/usr/bin/env bash
    echo "db push is how this schema drifted from its own migrations."
    echo "Use 'just migrate' instead. See docs/src/p1_data_model.md."
    exit 1

# Browse the data
db-studio:
    cd server && npx prisma studio

# Print the schema models and enums
db-models:
    @grep -nE "^model |^enum " server/prisma/schema.prisma

# Load the default common holiday calendar for this year and next. Safe to rerun.
seed-holidays:
    cd server && npx tsx prisma/seed-holidays.ts

# The five leave types, with a --dry-run that prints them without writing.
seed-leave-types *ARGS:
    cd server && npx tsx prisma/seed-leave-types.ts {{ARGS}}

# Let a locked-out user back in. They change it from Settings afterwards.
# Needed while RESEND_FROM_EMAIL cannot send, so no reset OTP goes out.
set-password USERNAME PASSWORD:
    cd server && npx tsx prisma/set-password.ts {{USERNAME}} {{PASSWORD}}

# What has been applied, and what has not. Reads production, changes nothing.
migrate-status:
    cd server && npx prisma migrate status

# Author a migration from a schema.prisma edit. Needs the shadow database up.
migrate name="":
    #!/usr/bin/env bash
    set -euo pipefail
    if ! docker exec {{shadow_container}} pg_isready -U postgres >/dev/null 2>&1; then
        echo "Shadow database is not running. Run 'just shadow-up' first."
        exit 1
    fi
    cd server
    # The CLI reads DIRECT_URL (see server/prisma.config.ts). Overriding
    # DATABASE_URL does nothing to it. Set the one it reads, then refuse to
    # continue unless it points somewhere local, because the failure mode of
    # getting this wrong is running a migration against production.
    export DIRECT_URL="{{shadow_url}}"
    export DATABASE_URL="{{shadow_url}}"
    export SHADOW_DATABASE_URL="{{shadow_diff_url}}"
    case "$DIRECT_URL" in
        *localhost:{{shadow_port}}*) ;;
        *) echo "Refusing to run: DIRECT_URL is not the shadow database."; exit 1 ;;
    esac
    if [ -n "{{name}}" ]; then
        npx prisma migrate dev --name "{{name}}"
    else
        npx prisma migrate dev
    fi

# A throwaway Postgres for migrate dev to diff against. Supabase gives no shadow.
shadow-up:
    #!/usr/bin/env bash
    set -euo pipefail
    if docker exec {{shadow_container}} pg_isready -U postgres >/dev/null 2>&1; then
        echo "Shadow already up on {{shadow_port}}."
        exit 0
    fi
    docker rm -f {{shadow_container}} >/dev/null 2>&1 || true
    docker run -d --name {{shadow_container}} \
        -e POSTGRES_PASSWORD=shadow -e POSTGRES_DB=shadow \
        -p {{shadow_port}}:5432 postgres:17-alpine >/dev/null
    for _ in $(seq 1 60); do
        docker exec {{shadow_container}} pg_isready -U postgres >/dev/null 2>&1 && break
        sleep 1
    done
    docker exec {{shadow_container}} psql -U postgres -qc "create database shadow_diff" >/dev/null 2>&1 || true
    echo "Shadow up on {{shadow_port}}. Postgres 17, matching production."
    echo "  shadow      the database migrations are applied to"
    echo "  shadow_diff the throwaway prisma migrate dev diffs against"

shadow-down:
    @docker rm -f {{shadow_container}} >/dev/null 2>&1 && echo "Shadow removed." || echo "Shadow was not running."

# Rehearse the production sequence against the shadow, then assert no drift.
# This is the check that has to pass before anyone runs migrate deploy for real.
migrate-verify:
    #!/usr/bin/env bash
    set -euo pipefail
    if ! docker exec {{shadow_container}} pg_isready -U postgres >/dev/null 2>&1; then
        echo "Shadow database is not running. Run 'just shadow-up' first."
        exit 1
    fi
    cd server
    # The CLI reads DIRECT_URL (see server/prisma.config.ts). Overriding
    # DATABASE_URL does nothing to it. Set the one it reads, then refuse to
    # continue unless it points somewhere local, because the failure mode of
    # getting this wrong is running a migration against production.
    export DIRECT_URL="{{shadow_url}}"
    export DATABASE_URL="{{shadow_url}}"
    unset SHADOW_DATABASE_URL
    case "$DIRECT_URL" in
        *localhost:{{shadow_port}}*) ;;
        *) echo "Refusing to run: DIRECT_URL is not the shadow database."; exit 1 ;;
    esac
    docker exec {{shadow_container}} psql -U postgres -d shadow -qc \
        "drop schema public cascade; create schema public;" >/dev/null
    echo "Applying the full history to an empty database."
    npx prisma migrate deploy >/dev/null
    echo "Asserting the result matches schema.prisma."
    drift=$(npx prisma migrate diff \
        --from-config-datasource --to-schema prisma/schema.prisma --script 2>/dev/null \
        | grep -cE '^\s*(CREATE|ALTER|DROP)' || true)
    if [ "$drift" -ne 0 ]; then
        echo "FAIL: $drift statements of drift between the migrations and schema.prisma."
        exit 1
    fi
    echo "OK: migrations and schema.prisma agree, no drift."

# ---------------------------------------------------------------- docs

# Serve the engineering handbook at http://localhost:3080 with live reload
docs:
    cd docs && mdbook serve --port 3080 --open

# Build the handbook to docs/book
docs-build:
    cd docs && mdbook build

# ---------------------------------------------------------------- checking

# Lint the client. The server has no linter configured.
lint:
    cd client && {{pm}} run lint

# Type check both without emitting
typecheck:
    cd server && npx tsc --noEmit -p tsconfig.json
    cd client && npx tsc --noEmit -p tsconfig.json

# Is the API up?
health:
    @curl -sS http://localhost:{{server_port}}/api/v1/dashboard -o /dev/null -w "API on {{server_port}}: HTTP %{http_code}\n" || echo "API not reachable on {{server_port}}"

# Runs from the pre-commit hook. Run it yourself before a push, the hook is local only.
# Fail if AI attribution is in a tracked file or in the recent history
no-ai-trails:
    #!/usr/bin/env bash
    set -uo pipefail
    # Attribution markers only. Naming a model in prose is not a trail, and
    # docs/src/p2_assistant.md legitimately prices Claude Haiku, Sonnet, and Opus.
    pat='Co-Authored-By:.*Claude|Generated with \[?Claude|Generated by Claude|claude\.ai/code|🤖'
    files=$(git grep -nIE "$pat" -- . ':!justfile' ':!CLAUDE.md' ':!docs/src/decisions.md')
    msgs=$(git log -50 --format='%h %s%n%b' | grep -E "$pat")
    if [ -n "$files" ] || [ -n "$msgs" ]; then
        echo "AI attribution found. Strip it before this goes anywhere."
        [ -n "$files" ] && echo "$files"
        [ -n "$msgs" ] && printf 'in commit messages:\n%s\n' "$msgs"
        exit 1
    fi
    echo "No AI trails."

# Every route the API exposes, grouped by controller
routes:
    #!/usr/bin/env bash
    cd server/src
    for f in $(find . -name "*.controller.ts" | sort); do
        echo "### $f"
        grep -nE "@(Controller|Get|Post|Patch|Put|Delete|Roles|Public)\(" "$f" | sed 's/^ *//'
    done

# A vendor is external. RolesGuard knows nothing about assignments, so adding
# VENDOR to an internal @Roles list opens that endpoint to every vendor for
# every record it returns. This turns that from a review promise into a build
# failure. See docs/src/p2_vendors.md.
vendor-roles:
    #!/usr/bin/env bash
    set -uo pipefail
    hits=$(grep -rn "role_enum.VENDOR" server/src/modules \
        --include="*.controller.ts" 2>/dev/null \
        | grep -v "server/src/modules/vendor-portal/" || true)
    if [ -n "$hits" ]; then
        echo "VENDOR appears on a controller outside modules/vendor-portal/."
        echo "Every vendor-reachable route lives in that namespace, scoped through"
        echo "vendor_assignments. Opening an internal route with a role branch is"
        echo "how the whole company's data leaks."
        echo "$hits"
        exit 1
    fi
    echo "No VENDOR roles outside the portal namespace."

# Nest instantiates the global guards inside whichever module owns each
# controller, so that module needs JwtService in scope. A module registering a
# controller without AuthModule typechecks, passes every test, and then fails
# at boot on JwtService. Only starting the app catches it.
#
# This compiles and runs the real entrypoint rather than importing through
# ts-node. ts-node --transpile-only swallowed the very exception this exists to
# catch and reported success on a build that could not start. The DI graph
# resolves before any database connection, so a connection failure here is not
# a boot failure and is ignored.
boot-check:
    #!/usr/bin/env bash
    set -uo pipefail
    cd server
    npx nest build >/dev/null 2>&1 || { echo "Build failed."; exit 1; }
    out=$(timeout 40 node dist/main.js 2>&1 || true)
    if echo "$out" | grep -qE "can.t resolve dependencies|UnknownDependenciesException|Cannot find module"; then
        echo "The app does not start:"
        echo "$out" | grep -E "ERROR|resolve dependencies" | head -3
        exit 1
    fi
    if echo "$out" | grep -q "Nest application successfully started"; then
        echo "App starts. Every module has its guards in scope."
        exit 0
    fi
    echo "App did not report a successful start:"
    echo "$out" | tail -5
    exit 1
