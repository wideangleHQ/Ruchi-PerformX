# RUCHI PerformX
#
# Run `just` with no arguments to see everything.
# Docs: `just docs` then open http://localhost:3080

# Package manager. Override per invocation: `just pm=npm install`
pm := "bun"

# Server listens here, client listens on SERVER_PORT + 1.
# The API CORS allowlist is hardcoded to localhost:4001, so do not move the client.
server_port := "4000"
client_port := "4001"

# Required environment variables, checked by `just check-env`.
# JWT_SECRET and VMS_JWT_SECRET kill the process at import time when missing.
server_env_required := "DATABASE_URL JWT_SECRET VMS_JWT_SECRET INTERNAL_API_KEY RESEND_API_KEY RESEND_FROM_EMAIL SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY SUPABASE_BUCKET SUPABASE_VMS_BUCKET"
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

# There is no migration history yet, see docs/src/p2_data_model.md
# Push schema changes to the database
db-push:
    cd server && npx prisma db push

# Browse the data
db-studio:
    cd server && npx prisma studio

# Print the schema models and enums
db-models:
    @grep -nE "^model |^enum " server/prisma/schema.prisma

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

# Every route the API exposes, grouped by controller
routes:
    #!/usr/bin/env bash
    cd server/src
    for f in $(find . -name "*.controller.ts" | sort); do
        echo "### $f"
        grep -nE "@(Controller|Get|Post|Patch|Put|Delete|Roles|Public)\(" "$f" | sed 's/^ *//'
    done
