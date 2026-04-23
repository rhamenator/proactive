# syntax=docker/dockerfile:1

# ── Stage 1: build ──────────────────────────────────────────────────────────
# node:22-alpine may carry a high-severity CVE in the Node.js binary itself
# for which no Alpine-level patch is yet available.  Mitigation: `apk upgrade
# --no-cache` (see below) applies all available OS-level fixes automatically;
# the image will self-heal on the next build once an upstream patch ships.
# trivy.yaml suppresses this unfixed CVE in CI scanning.
FROM node:22-alpine AS builder

# Upgrade all system packages to pick up any security patches published since
# the base image was built (no-op today if image is already fully patched).
RUN apk upgrade --no-cache

WORKDIR /repo

# Copy workspace manifests first so Docker can cache the install layer
COPY package.json package-lock.json ./
COPY backend/package.json        ./backend/
COPY admin-dashboard/package.json ./admin-dashboard/
COPY mobile-app/package.json     ./mobile-app/

# Install ALL deps (including devDependencies needed for tsc + prisma generate)
RUN npm ci

# Copy backend source + Prisma schema
COPY backend/ ./backend/

# Generate Prisma client (writes into node_modules/.prisma/)
RUN npx prisma generate --schema=./backend/prisma/schema.prisma

# Compile TypeScript
RUN npm run build -w backend

# ── Stage 2: production image ────────────────────────────────────────────────
# Same base-image note as Stage 1 above — apk upgrade handles OS patches.
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# dumb-init ensures proper PID 1 signal handling (SIGTERM → graceful shutdown)
RUN apk upgrade --no-cache && apk add --no-cache dumb-init

# Re-copy workspace manifests and install *production-only* deps
COPY package.json package-lock.json ./
COPY backend/package.json        ./backend/
COPY admin-dashboard/package.json ./admin-dashboard/
COPY mobile-app/package.json     ./mobile-app/
RUN npm ci --omit=dev

# Copy the Prisma query engine (generated binary – not in npm registry)
COPY --from=builder --chown=node:node /repo/node_modules/.prisma ./node_modules/.prisma

# Copy compiled application
COPY --from=builder --chown=node:node /repo/backend/dist ./dist

# Copy Prisma schema so `prisma migrate deploy` can run at startup if needed
COPY --chown=node:node backend/prisma ./prisma

EXPOSE 3001

USER node

CMD ["dumb-init", "node", "dist/main.js"]
