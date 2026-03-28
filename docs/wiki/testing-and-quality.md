# Testing And Quality

## Current Test Layers

### Backend

- Jest
- service tests
- controller tests
- guard tests

Run:

```bash
npm test --workspace @proactive/backend -- --runInBand
```

### Admin Dashboard

- Vitest
- API helper tests
- browser storage helper tests

Run:

```bash
npm test --workspace @proactive/admin-dashboard
```

### Mobile App

- Vitest
- API client tests
- local ID generation tests
- storage normalization tests

Run:

```bash
npm test --workspace mobile-app
```

## Full Repo Commands

```bash
npm test
npm run test:coverage
npm run build
```

## What Coverage Means Here

High-confidence areas:

- backend auth and turf lifecycle logic
- backend visit/GPS logic
- admin API helper behavior
- mobile client/storage utility behavior

Lower-confidence areas still needing broader test layers:

- admin UI route behavior
- mobile `AppContext` orchestration
- mobile screen-level interaction tests
- backend integration tests against live request flows

## Quality Expectation

This repo is not relying only on linting or typechecks. The current test suite is intended to catch:

- invalid enum or role assumptions
- broken auth/session logic
- turf lifecycle regressions
- visit deduplication and sync mistakes
- client API contract regressions
- storage normalization regressions
