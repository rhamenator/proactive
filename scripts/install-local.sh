#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Install the local PROACTIVE development stack.

Usage:
  scripts/install-local.sh [options]

Options:
  --skip-db       Do not run Prisma migrations or seed data.
  --skip-install  Do not run npm install.
  --help          Show this help text.

Prerequisites:
  - Node.js 22 or newer
  - npm
  - PostgreSQL running and reachable by backend/.env DATABASE_URL unless --skip-db is used
USAGE
}

SKIP_DB=0
SKIP_INSTALL=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-db)
      SKIP_DB=1
      shift
      ;;
    --skip-install)
      SKIP_INSTALL=1
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

log() {
  printf '\n==> %s\n' "$1"
}

copy_env_if_missing() {
  local source_file="$1"
  local target_file="$2"

  if [[ -f "$target_file" ]]; then
    echo "Keeping existing $target_file"
    return
  fi

  cp "$source_file" "$target_file"
  echo "Created $target_file from $source_file"
}

require_command() {
  local command_name="$1"

  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing required command: $command_name" >&2
    exit 1
  fi
}

require_command node
require_command npm

NODE_MAJOR="$(node -p "Number(process.versions.node.split('.')[0])")"
if [[ "$NODE_MAJOR" -lt 22 ]]; then
  echo "Node.js 22 or newer is required. Current version: $(node --version)" >&2
  exit 1
fi

log "Preparing environment files"
copy_env_if_missing "backend/.env.example" "backend/.env"
copy_env_if_missing "admin-dashboard/.env.example" "admin-dashboard/.env.local"
copy_env_if_missing "mobile-app/.env.example" "mobile-app/.env"

if [[ "$SKIP_INSTALL" -eq 0 ]]; then
  log "Installing npm dependencies"
  npm install
else
  log "Skipping npm install"
fi

log "Generating Prisma client"
npm run prisma:generate

if [[ "$SKIP_DB" -eq 0 ]]; then
  log "Applying database migrations"
  (
    cd backend
    npx prisma migrate deploy
  )

  log "Seeding local demo accounts and sample data"
  npm run prisma:seed --workspace @proactive/backend
else
  log "Skipping database migration and seed"
fi

cat <<'NEXT_STEPS'

Local installation complete.

Start the system in three terminals:
  npm run dev:backend
  npm run dev:admin
  npm run dev:mobile

Default URLs:
  Admin dashboard: http://localhost:3000
  Backend API:     http://localhost:3001

Seed accounts:
  Admin:      admin@proactive.local / Password123!
  Canvasser:  canvasser@proactive.local / Password123!

If database setup failed, confirm PostgreSQL is running and backend/.env DATABASE_URL is correct,
then rerun scripts/install-local.sh.
NEXT_STEPS
