# Testing And Quality

## Current Test Layers

This repository now uses a layered test strategy for UI quality:

1. Fast mocked UI/API tests for deterministic state coverage.
2. Seeded integration/browser tests for real-backend semantics where state correctness matters.

Mocked tests are not treated as sufficient alone for this product.

### Backend

- Jest
- service tests
- controller tests
- guard tests
- deterministic seeded-data script for UI integration/e2e scenarios

Run:

```bash
npm test --workspace @proactive/backend -- --runInBand
npm run prisma:seed:e2e --workspace @proactive/backend
```

### Admin Dashboard

- Vitest
- API helper tests
- browser storage helper tests
- MSW-backed API tests (`api.msw.spec.ts`) using shared fake-data scenarios
- Playwright browser e2e with project split:
  - `mocked`: deterministic route-level coverage with fake data
  - `seeded`: real backend/test DB flow coverage scaffold

Run:

```bash
npm test --workspace @proactive/admin-dashboard
npm run test:e2e:mocked --workspace @proactive/admin-dashboard
npm run test:e2e:seeded --workspace @proactive/admin-dashboard
```

Notes:

- Playwright config is in `admin-dashboard/playwright.config.ts`.
- Browser tests use port `3100` by default.
- Seeded project expects a reachable backend at `http://127.0.0.1:3001` and runs deterministic DB seeding before test execution.

### Mobile App

- Vitest
- API client tests
- local ID generation tests
- storage normalization tests
- new offline/local-first persistence flow tests (`storage.offline-flow.spec.ts`)
- Detox e2e scaffold (configuration + placeholder smoke spec)

Run:

```bash
npm test --workspace mobile-app
npm run build:e2e:mobile:ios --workspace mobile-app
npm run test:e2e:mobile:ios --workspace mobile-app
```

Notes:

- Detox setup is scaffolded in `mobile-app/.detoxrc.js` and `mobile-app/e2e/`.
- Full simulator/device pipeline is intentionally staged; current immediate value comes from deterministic offline-state Vitest coverage.

## Shared Fake Data And Mocking

- Shared deterministic factories/scenarios:
  - `testing/fake-data/factories.ts`
  - `testing/fake-data/scenarios.ts`
- Shared admin mock scenario + MSW handlers:
  - `testing/mocks/admin-dashboard/scenario.ts`

These fixtures are designed to support both mocked tests and backend seeding.

## Seeded Integration Coverage (Current Subset)

Initial seeded browser suite focuses on high-risk semantics first:

- login + MFA verification flow
- MFA-sensitive export action flow
- reports filtering flow with timezone-aware assertions, including report-local date-only filters
- queue surface loading (sync conflicts, import review, address requests)
- export CSV timestamp regression assertions for UTC and non-UTC formatting
- team-first supervisor policy invariant coverage (reject/normalize legacy `campaign` scope mode)

## Full Repo Commands

```bash
npm test
npm run test:coverage
npm run test:ui:mocked
npm run test:ui:seeded
npm run build
```

## What Is Intentionally Deferred

This pass adds a maintainable foundation and representative high-value coverage, not exhaustive e2e breadth.

Deferred to next passes:

- deeper seeded browser coverage for all admin critical flows (full CSV preview/import/resolve loops, broader role/scope matrix, supervisor-only slices)
- mobile Detox execution in CI with stable simulator build pipeline
- fuller real-backend conflict synthesis matrix (multiple conflict reasons and replay behaviors)
- larger cross-role seeded fixtures for admin/supervisor/canvasser report differentials

## What Coverage Means Here

High-confidence areas:

- backend auth and turf lifecycle logic
- backend visit/GPS logic
- report bucket timezone/date-filter behavior
- admin API helper behavior
- admin mocked browser interaction flows for reports + queue pages
- mobile client/storage utility behavior
- mobile offline local-first persistence behavior

Lower-confidence areas still needing broader test layers:

- full seeded browser coverage across every admin route/action path
- mobile `AppContext` full orchestration under simulator/device E2E
- mobile screen-level interaction suites beyond current offline-state tests
- end-to-end CI wiring for seeded UI + mobile simulator runs

## Quality Expectation

This repo is not relying only on linting or typechecks. The current test suite is intended to catch:

- invalid enum or role assumptions
- broken auth/session logic
- turf lifecycle regressions
- visit deduplication and sync mistakes
- report timezone/day-boundary regressions
- export timestamp ambiguity regressions
- client API contract regressions
- storage normalization regressions
