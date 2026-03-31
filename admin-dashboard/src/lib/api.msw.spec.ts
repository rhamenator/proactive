import { describe, expect, it } from 'vitest';

import { createAdminMockScenario, createAdminMswHandlers } from '../../../testing/mocks/admin-dashboard/scenario';
import { createApiClient } from './api';
import { mswServer } from '../test/msw-server';

describe('admin api client with MSW handlers', () => {
  it('loads report + queue surfaces from shared mock handlers', async () => {
    const scenario = createAdminMockScenario();
    mswServer.use(...createAdminMswHandlers(scenario));

    const api = createApiClient('mock-token');

    const [overview, productivity, syncConflicts, addressRequests] = await Promise.all([
      api.reportsOverview({ dateFrom: '2026-03-30', dateTo: '2026-03-30' }),
      api.reportsProductivity({ gpsStatus: 'flagged' }),
      api.syncConflictQueue(),
      api.listAddressRequestsForReview({ take: 50 })
    ]);

    expect(overview.kpis.totalVisits).toBe(2);
    expect(overview.generatedAtTimezone).toBe('UTC');
    expect(productivity.rows).toHaveLength(1);
    expect(syncConflicts[0]?.syncStatus).toBe('conflict');
    expect(addressRequests[0]?.requestedAddress.addressLine2).toBe('Apt 9');
  });

  it('serves export and import review APIs with realistic queue data', async () => {
    const scenario = createAdminMockScenario();
    mswServer.use(...createAdminMswHandlers(scenario));

    const api = createApiClient('mock-token');
    const [history, reviews] = await Promise.all([
      api.listExportHistory(),
      api.listImportReviewQueue({ take: 25 })
    ]);

    expect(history[0]?.filename).toContain('van-results');
    expect(history[0]?._count?.exportedVisits).toBe(2);
    expect(reviews[0]?.status).toBe('pending_review');
    expect(reviews[0]?.candidateAddress?.vanId).toBeDefined();
  });
});
