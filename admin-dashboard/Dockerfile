# syntax=docker/dockerfile:1

# ── Stage 1: build ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /repo

# Copy workspace manifests first so Docker can cache the install layer
COPY package.json package-lock.json ./
COPY backend/package.json        ./backend/
COPY admin-dashboard/package.json ./admin-dashboard/
COPY mobile-app/package.json     ./mobile-app/

# Install ALL deps (including devDependencies needed for next build)
RUN npm ci

# Copy admin-dashboard source
COPY admin-dashboard/ ./admin-dashboard/

# Build Next.js with standalone output (configured in next.config.mjs)
RUN npm run build -w admin-dashboard

# ── Stage 2: production image ────────────────────────────────────────────────
# next build --output=standalone produces a self-contained server directory.
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
# Disable Next.js telemetry inside containers
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN apk add --no-cache dumb-init

# Standalone output is fully self-contained (includes its own node_modules).
# In a monorepo the server entry point lives at the workspace-relative path.
COPY --from=builder --chown=node:node /repo/admin-dashboard/.next/standalone ./

# Static assets are not bundled into standalone and must be copied separately.
COPY --from=builder --chown=node:node /repo/admin-dashboard/.next/static \
     ./admin-dashboard/.next/static

# Public (user-facing) assets
COPY --from=builder --chown=node:node /repo/admin-dashboard/public \
     ./admin-dashboard/public

EXPOSE 3000

USER node

# server.js is created by Next.js at the root of the standalone directory
CMD ["dumb-init", "node", "admin-dashboard/server.js"]
