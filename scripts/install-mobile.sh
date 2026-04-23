#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Prepare the PROACTIVE mobile app on a developer/build machine.

This script does not run on iOS or Android devices. It prepares the Expo
workspace and environment files used to run Expo locally or build installable
mobile artifacts through EAS.

Usage:
  scripts/install-mobile.sh [options]

Options:
  --api-url URL      Set EXPO_PUBLIC_API_URL in mobile-app/.env.
  --preview-env      Create mobile-app/.env.preview from the preview template if missing.
  --production-env   Create mobile-app/.env.production from the production template if missing.
  --skip-install     Do not run npm install.
  --help             Show this help text.

Examples:
  scripts/install-mobile.sh
  scripts/install-mobile.sh --api-url http://10.0.2.2:3001
  scripts/install-mobile.sh --preview-env --api-url https://api-preview.example.org
USAGE
}

API_URL=""
CREATE_PREVIEW_ENV=0
CREATE_PRODUCTION_ENV=0
SKIP_INSTALL=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --api-url)
      if [[ $# -lt 2 ]]; then
        echo "--api-url requires a value" >&2
        exit 1
      fi
      API_URL="$2"
      shift 2
      ;;
    --preview-env)
      CREATE_PREVIEW_ENV=1
      shift
      ;;
    --production-env)
      CREATE_PRODUCTION_ENV=1
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

set_env_value() {
  local file="$1"
  local key="$2"
  local value="$3"

  if grep -q "^${key}=" "$file"; then
    sed -i.bak "s#^${key}=.*#${key}=${value}#" "$file"
    rm -f "${file}.bak"
  else
    printf '%s=%s\n' "$key" "$value" >> "$file"
  fi
}

if ! command -v node >/dev/null 2>&1; then
  echo "Missing required command: node" >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Missing required command: npm" >&2
  exit 1
fi

NODE_MAJOR="$(node -p "Number(process.versions.node.split('.')[0])")"
if [[ "$NODE_MAJOR" -lt 22 ]]; then
  echo "Node.js 22 or newer is required. Current version: $(node --version)" >&2
  exit 1
fi

log "Preparing mobile environment files"
copy_env_if_missing "mobile-app/.env.example" "mobile-app/.env"

if [[ "$CREATE_PREVIEW_ENV" -eq 1 ]]; then
  copy_env_if_missing "mobile-app/.env.preview.example" "mobile-app/.env.preview"
fi

if [[ "$CREATE_PRODUCTION_ENV" -eq 1 ]]; then
  copy_env_if_missing "mobile-app/.env.production.example" "mobile-app/.env.production"
fi

if [[ -n "$API_URL" ]]; then
  set_env_value "mobile-app/.env" "EXPO_PUBLIC_API_URL" "$API_URL"
  [[ -f "mobile-app/.env.preview" ]] && set_env_value "mobile-app/.env.preview" "EXPO_PUBLIC_API_URL" "$API_URL"
  [[ -f "mobile-app/.env.production" ]] && set_env_value "mobile-app/.env.production" "EXPO_PUBLIC_API_URL" "$API_URL"
  echo "Set EXPO_PUBLIC_API_URL=$API_URL"
fi

if [[ "$SKIP_INSTALL" -eq 0 ]]; then
  log "Installing npm dependencies"
  npm install
else
  log "Skipping npm install"
fi

log "Checking mobile TypeScript build"
npm run typecheck --workspace mobile-app

cat <<'NEXT_STEPS'

Mobile setup complete.

For local development:
  npm run dev:backend
  npm run dev:mobile

Useful API URLs:
  iOS simulator:      http://localhost:3001
  Android emulator:   http://10.0.2.2:3001
  Physical device:    http://<your-computer-LAN-IP>:3001

For internal preview binaries:
  cd mobile-app
  npx eas login
  npm run eas:build:ios:preview
  npm run eas:build:android:preview
NEXT_STEPS
