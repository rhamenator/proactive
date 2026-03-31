import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.PW_BASE_URL ?? 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'mocked',
      use: {
        ...devices['Desktop Chrome']
      },
      grep: /@mocked/
    },
    {
      name: 'seeded',
      use: {
        ...devices['Desktop Chrome']
      },
      grep: /@seeded/
    }
  ],
  webServer: [
    {
      command:
        "sh -c 'cd .. && npm run build --workspace @proactive/backend && DISABLE_RETENTION_AUTOMATION=true node backend/dist/src/main.js'",
      url: 'http://127.0.0.1:3001/',
      reuseExistingServer: true,
      timeout: 180_000
    },
    {
      command:
        "sh -c 'cd .. && NEXT_PUBLIC_API_URL=http://127.0.0.1:3001 npm run dev --workspace @proactive/admin-dashboard -- --hostname 127.0.0.1 --port 3100'",
      url: 'http://127.0.0.1:3100/login',
      reuseExistingServer: true,
      timeout: 120_000
    }
  ]
});
