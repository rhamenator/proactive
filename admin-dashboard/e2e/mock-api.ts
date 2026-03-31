import type { Page, Route } from '@playwright/test';

import { createAdminMockScenario } from '../../testing/mocks/admin-dashboard/scenario';

const scenario = createAdminMockScenario();

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
}

export async function registerAdminMockRoutes(page: Page) {
  await page.route('**/auth/login', (route) => json(route, scenario.login));
  await page.route('**/auth/mfa/step-up', (route) => json(route, scenario.login));
  await page.route('**/me', (route) => json(route, scenario.me));

  await page.route('**/admin/dashboard-summary', (route) =>
    json(route, {
      totals: {
        users: 3,
        admins: 1,
        supervisors: 1,
        canvassers: 1,
        turfs: 1,
        addresses: 2,
        assignments: 1,
        activeSessions: 1,
        totalVisits: 2,
        completedAddresses: 2
      },
      activeCanvassers: [],
      turfs: [{ id: 'turf-mock-1', name: scenario.turfs[0].name, progressPercent: 50 }]
    })
  );

  await page.route('**/reports/overview**', (route) => json(route, scenario.reports.overview));
  await page.route('**/reports/productivity**', (route) => json(route, scenario.reports.productivity));
  await page.route('**/reports/gps-exceptions**', (route) => json(route, scenario.reports.gpsExceptions));
  await page.route('**/reports/audit-activity**', (route) => json(route, scenario.reports.auditActivity));
  await page.route('**/reports/trends**', (route) => json(route, scenario.reports.trends));
  await page.route('**/reports/resolved-conflicts**', (route) => json(route, scenario.reports.resolvedConflicts));
  await page.route('**/reports/export-batches**', (route) => json(route, scenario.reports.exportBatches));

  await page.route('**/admin/campaigns', (route) => json(route, scenario.campaigns));
  await page.route('**/turfs', (route) => json(route, scenario.turfs));
  await page.route('**/admin/canvassers', (route) => json(route, scenario.canvassers));
  await page.route('**/admin/outcomes', (route) => json(route, scenario.outcomes));

  await page.route('**/exports/history', (route) => json(route, scenario.exports.history));
  await page.route('**/exports/van-results**', (route) =>
    route.fulfill({
      status: 200,
      headers: {
        'content-type': 'text/csv',
        'content-disposition': 'attachment; filename="van-results-2026-03-30.csv"'
      },
      body: 'event_time,time_zone\n2026-03-30T06:30:00.000Z,UTC\n'
    })
  );
  await page.route('**/imports/review-queue**', (route) => json(route, scenario.importReviewQueue));
  await page.route('**/imports/review-queue/*/resolve', (route) =>
    json(route, {
      id: 'import-row-1',
      status: 'merged',
      resolutionAction: 'merge'
    })
  );

  await page.route('**/admin/sync-conflicts', (route) => json(route, scenario.syncConflicts));
  await page.route('**/admin/sync-conflicts/*/resolve', (route) =>
    json(route, {
      ...scenario.syncConflicts[0],
      syncStatus: 'synced',
      syncConflictFlag: false,
      syncConflictReason: null
    })
  );

  await page.route('**/address-requests/review**', (route) => json(route, scenario.addressRequests));
  await page.route('**/address-requests/*/approve', (route) =>
    json(route, {
      ...scenario.addressRequests[0],
      status: 'approved',
      reviewedAt: '2026-03-30T12:10:00.000Z',
      reviewReason: 'Validated by reviewer'
    })
  );
}

export function getMockScenario() {
  return scenario;
}
