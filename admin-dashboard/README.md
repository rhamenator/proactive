# PROACTIVE Admin Dashboard

Next.js admin dashboard for the PROACTIVE Field Canvassing System.

## Setup

Recommended first-time setup is from the repository root:

```bash
npm run setup:local
```

Dashboard-only setup for experienced developers:

```bash
cp .env.example .env.local
npm install
```

## Development

From the repository root:

```bash
npm run dev:admin
```

From `admin-dashboard/`:

```bash
npm run dev
```

The dashboard expects the backend API to be running at `NEXT_PUBLIC_API_URL` and uses browser-local JWT storage for the session.

## Testing

### Unit/API/UI-state (Vitest)

```bash
npm run test
```

This includes MSW-backed deterministic API tests wired through `src/test/setup.ts` and shared handlers in `../testing/mocks/admin-dashboard/scenario.ts`.

### Browser E2E (Playwright)

Mocked deterministic flows:

```bash
npm run test:e2e:mocked
```

Seeded real-backend flows:

```bash
npm run test:e2e:seeded
```

Notes:

- Config: `playwright.config.ts`.
- The Playwright admin server runs on port `3100` by default.
- Seeded tests run deterministic backend seeding before execution.
