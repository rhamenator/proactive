# syntax=docker/dockerfile:1

# ── Stage 1: build ──────────────────────────────────────────────────────────
# node:22-alpine may carry a high-severity CVE in the Node.js binary itself
# for which no Alpine-level patch is yet available.  Mitigation: `apk upgrade
# --no-cache` (see below) applies all available OS-level fixes automatically;
# the image will self-heal on the next build once an upstream patch ships.
# trivy.yaml suppresses this unfixed CVE in CI scanning.
FROM node:22-alpine@sha256:8ea2348b068a9544dae7317b4f3aafcdc032df1647bb7d768a05a5cad1a7683f AS builder

# Upgrade all system packages to pick up any security patches published since
# the base image was built (no-op today if image is already fully patched).
RUN apk upgrade --no-cache

WORKDIR /repo

# Copy workspace manifests first so Docker can cache the install layer
COPY package.json package-lock.json ./
COPY backend/package.json        ./backend/
COPY admin-dashboard/package.json ./admin-dashboard/
COPY mobile-app/package.json     ./mobile-app/

# Install ALL deps (including devDependencies needed for next build).
# Ignore root postinstall because this image does not copy the backend Prisma schema.
RUN npm ci --ignore-scripts

# Copy admin-dashboard source
COPY admin-dashboard/ ./admin-dashboard/
COPY testing/ ./testing/

# Build Next.js with standalone output (configured in next.config.mjs)
RUN npm run build -w admin-dashboard

# ── Stage 2: production image ────────────────────────────────────────────────
# next build --output=standalone produces a self-contained server directory.
# Same base-image note as Stage 1 above — apk upgrade handles OS patches.
FROM node:22-alpine@sha256:8ea2348b068a9544dae7317b4f3aafcdc032df1647bb7d768a05a5cad1a7683f AS runner

WORKDIR /app

ENV NODE_ENV=production
# Disable Next.js telemetry inside containers
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN apk upgrade --no-cache && apk add --no-cache dumb-init

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

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/').then((r)=>process.exit(r.ok ? 0 : 1)).catch(()=>process.exit(1))"

# server.js is created by Next.js at the root of the standalone directory
CMD ["dumb-init", "node", "admin-dashboard/server.js"]
