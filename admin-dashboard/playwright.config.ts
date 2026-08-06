import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

const repositoryRoot = path.resolve(__dirname, '..');
const mockedOnly = process.argv.some((argument) => argument === '--project=mocked');

const backendWebServer = {
  command:
    'npm run build --workspace @proactive/backend && node --env-file=backend/.env backend/dist/src/main.js',
  cwd: repositoryRoot,
  env: {
    ...process.env,
    DISABLE_RETENTION_AUTOMATION: 'true'
  },
  url: 'http://127.0.0.1:3001/',
  reuseExistingServer: true,
  timeout: 180_000
};

const dashboardWebServer = {
  command:
    'npm run dev --workspace @proactive/admin-dashboard -- --hostname 127.0.0.1 --port 3100',
  cwd: repositoryRoot,
  env: {
    ...process.env,
    NEXT_PUBLIC_API_URL: 'http://127.0.0.1:3001'
  },
  url: 'http://127.0.0.1:3100/login',
  reuseExistingServer: true,
  timeout: 120_000
};

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
  webServer: mockedOnly ? [dashboardWebServer] : [backendWebServer, dashboardWebServer]
});
