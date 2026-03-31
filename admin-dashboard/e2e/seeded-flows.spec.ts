import { execSync } from 'node:child_process';

import { expect, test } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';

import { createAdminUiScenario } from '../../testing/fake-data/scenarios';
import { generateTotp, seedAdminSession } from './test-helpers';

const seededScenario = createAdminUiScenario('seeded-e2e');

async function loginAsSeededAdmin(page: import('@playwright/test').Page, request: APIRequestContext) {
  const loginResponse = await request.post('http://127.0.0.1:3001/auth/login', {
    data: {
      email: seededScenario.admin.email,
      password: 'Password123!'
    }
  });

  expect(loginResponse.ok()).toBeTruthy();
  const loginBody = await loginResponse.json();

  if (loginBody?.mfaRequired) {
    const verifyResponse = await request.post('http://127.0.0.1:3001/auth/mfa/verify', {
      data: {
        challengeToken: loginBody.challengeToken,
        code: generateTotp(seededScenario.mfaSecret)
      }
    });

    expect(verifyResponse.ok()).toBeTruthy();
    const verifyBody = await verifyResponse.json();
    await seedAdminSession(page, page.context(), {
      token: verifyBody.accessToken,
      user: verifyBody.user
    });
    return;
  }

  await seedAdminSession(page, page.context(), {
    token: loginBody.accessToken,
    user: loginBody.user
  });
}

test.describe('admin dashboard seeded real-backend flows @seeded', () => {
  test.beforeAll(() => {
    execSync('npm run prisma:seed:e2e --workspace @proactive/backend', {
      cwd: process.cwd(),
      env: {
        ...process.env,
        E2E_ALLOW_DATABASE_SEED: 'true'
      },
      stdio: 'inherit'
    });
  });

  test('runs login + MFA-sensitive export flow and verifies timezone column policy', async ({ page, request }) => {
    await loginAsSeededAdmin(page, request);

    await page.goto('/exports');
    await page.getByRole('button', { name: 'Download VAN Results CSV' }).click();
    await expect(page.getByRole('heading', { name: 'Verify MFA to continue' })).toBeVisible();

    await page.getByLabel('MFA or backup code').fill(generateTotp(seededScenario.mfaSecret));
    await page.getByRole('button', { name: 'Verify And Continue' }).click();

    await expect(page.getByText('CSV downloaded as')).toBeVisible();

    const token = await page.evaluate(() => window.localStorage.getItem('proactive.admin.token'));
    expect(token).toBeTruthy();

    const response = await request.get('http://127.0.0.1:3001/exports/van-results', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    expect(response.ok()).toBeTruthy();
    const csv = await response.text();
    expect(csv).toContain('time_zone');
    expect(csv).toContain('UTC');
  });

  test('applies report filters against seeded backend data with timezone-aware output', async ({ page }) => {
    await loginAsSeededAdmin(page, page.request);

    await page.goto('/reports');

    await page.getByLabel('Date from').fill('2026-03-30');
    await page.getByLabel('Date to').fill('2026-03-30');
    await page.getByLabel('Campaign').selectOption({ label: seededScenario.campaign.name });
    await page.getByLabel('GPS status').selectOption('flagged');

    const overviewRequest = page.waitForRequest((req) =>
      req.url().includes('/reports/overview') && req.url().includes('gpsStatus=flagged')
    );
    await page.getByRole('button', { name: 'Refresh' }).click();

    const request = await overviewRequest;
    const query = new URL(request.url()).searchParams;
    expect(query.get('gpsStatus')).toBe('flagged');

    await expect(page.getByText(/Trend buckets are calculated in UTC\./)).toBeVisible();
    await expect(page.getByText(/^2026-03-30$/)).toBeVisible();
  });

  test('loads real sync conflict, import-review, and address-request queues', async ({ page }) => {
    await loginAsSeededAdmin(page, page.request);

    await page.goto('/sync-conflicts');
    await expect(page.getByText('payload_mismatch')).toBeVisible();

    await page.goto('/import-reviews');
    await expect(page.getByRole('heading', { name: 'Import Reviews' })).toBeVisible();

    await page.goto('/address-requests');
    await expect(page.getByText('555 Added Ave')).toBeVisible();
    await expect(page.getByText('Detroit, MI 48201')).toBeVisible();
  });
});
