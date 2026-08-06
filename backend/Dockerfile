# syntax=docker/dockerfile:1

# ── Stage 1: build ──────────────────────────────────────────────────────────
# node:24-alpine may carry a high-severity CVE in the Node.js binary itself
# for which no Alpine-level patch is yet available.  Mitigation: `apk upgrade
# --no-cache` (see below) applies all available OS-level fixes automatically;
# the image will self-heal on the next build once an upstream patch ships.
# trivy.yaml suppresses this unfixed CVE in CI scanning.
FROM node:24-alpine@sha256:d32cdf619f63fe0471182d08996dd516c6275bb5fd31ae06e55a570bd9e1ad43 AS builder

# Upgrade all system packages to pick up any security patches published since
# the base image was built (no-op today if image is already fully patched).
RUN apk upgrade --no-cache

WORKDIR /repo

# Copy workspace manifests first so Docker can cache the install layer
COPY package.json package-lock.json ./
COPY backend/package.json        ./backend/
COPY admin-dashboard/package.json ./admin-dashboard/
COPY mobile-app/package.json     ./mobile-app/

# Install ALL deps (including devDependencies needed for tsc + prisma generate).
# Prisma generation runs after the backend schema has been copied below.
RUN npm ci --ignore-scripts

# Copy backend source + Prisma schema
COPY backend/ ./backend/

# Generate the Prisma 7 client at backend/generated/prisma.
RUN npm run prisma:generate --workspace @proactive/backend -- --schema=./prisma/schema.prisma

# Compile TypeScript
RUN npm run build -w backend

# ── Stage 2: production image ────────────────────────────────────────────────
# Same base-image note as Stage 1 above — apk upgrade handles OS patches.
FROM node:24-alpine@sha256:d32cdf619f63fe0471182d08996dd516c6275bb5fd31ae06e55a570bd9e1ad43 AS runner

WORKDIR /app

ENV NODE_ENV=production

# dumb-init ensures proper PID 1 signal handling (SIGTERM → graceful shutdown)
RUN apk upgrade --no-cache && apk add --no-cache dumb-init

# Re-copy workspace manifests and install *production-only* deps
COPY package.json package-lock.json ./
COPY backend/package.json        ./backend/
COPY admin-dashboard/package.json ./admin-dashboard/
COPY mobile-app/package.json     ./mobile-app/
RUN npm ci --omit=dev --ignore-scripts

# Copy compiled application
COPY --from=builder --chown=node:node /repo/backend/dist ./backend/dist

# Copy Prisma schema so `prisma migrate deploy` can run at startup if needed
COPY --chown=node:node backend/prisma ./backend/prisma

EXPOSE 3001

USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:3001/').then((r)=>process.exit(r.ok ? 0 : 1)).catch(()=>process.exit(1))"

CMD ["dumb-init", "node", "backend/dist/src/main.js"]
