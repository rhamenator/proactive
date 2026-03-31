import { expect, test } from '@playwright/test';

import { getMockScenario, registerAdminMockRoutes } from './mock-api';
import { seedAdminSession } from './test-helpers';

test.describe('admin dashboard mocked UI flows @mocked', () => {
  test.beforeEach(async ({ page }) => {
    await registerAdminMockRoutes(page);
  });

  test('supports login flow and reports filter interactions', async ({ page, context }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin.e2e@example.test');
    await page.getByLabel('Password').fill('Password123!');
    await page.getByRole('button', { name: 'Open Dashboard' }).click();

    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto('/reports');
    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();

    const overviewRequest = page.waitForRequest((request) => {
      if (!request.url().includes('/reports/overview')) {
        return false;
      }
      const params = new URL(request.url()).searchParams;
      return params.get('dateTo') === '2026-03-30' && params.get('gpsStatus') === 'flagged';
    });

    await page.getByLabel('Date from').fill('2026-03-30');
    await page.getByLabel('Date to').fill('2026-03-30');
    await page.getByLabel('Campaign').selectOption('campaign-mock-1');
    await page.getByLabel('Turf').selectOption('turf-mock-1');
    await page.getByLabel('Canvasser').selectOption('canvasser-mock-1');
    await page.getByLabel('GPS status').selectOption('flagged');
    await page.getByRole('button', { name: 'Refresh' }).click();

    const request = await overviewRequest;
    const query = new URL(request.url()).searchParams;
    expect(query.get('dateFrom')).toBe('2026-03-30');
    expect(query.get('dateTo')).toBe('2026-03-30');
    expect(query.get('campaignId')).toBe('campaign-mock-1');
    expect(query.get('turfId')).toBe('turf-mock-1');
    expect(query.get('canvasserId')).toBe('canvasser-mock-1');
    expect(query.get('gpsStatus')).toBe('flagged');
    await expect(page.getByText('Trend buckets are calculated in UTC.')).toBeVisible();
  });

  test('renders review queues and resolves sync conflicts', async ({ page, context }) => {
    const scenario = getMockScenario();
    await seedAdminSession(page, context, {
      token: 'mock-token',
      user: scenario.me
    });

    await page.goto('/sync-conflicts');
    await expect(page.getByText('payload_mismatch')).toBeVisible();
    await page.getByLabel('Resolution reason').fill('Validated by reviewer during mock test');
    await page.getByRole('button', { name: 'Resolve Conflict' }).click();
    await page.getByLabel('MFA or backup code').fill('123456');
    await page.getByRole('button', { name: 'Verify And Continue' }).click();
    await expect(page.getByText('Sync conflict cleared.')).toBeVisible();

    await page.goto('/import-reviews');
    page.once('dialog', (dialog) => dialog.accept('Merge from mocked queue'));
    await page.getByRole('button', { name: 'Merge Into Existing Address' }).click();
    await expect(page.getByText('Import row merged into existing address.')).toBeVisible();

    await page.goto('/address-requests');
    page.once('dialog', (dialog) => dialog.accept('Validated by reviewer'));
    await page.getByRole('button', { name: 'Approve' }).click();
    await expect(page.getByText('Address request approved.')).toBeVisible();
  });
});
