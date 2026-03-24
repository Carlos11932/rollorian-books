import { defineConfig, devices } from '@playwright/test'

const isCI = !!process.env.CI

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: 1,
  reporter: isCI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // In CI, start the server automatically. Locally, dev server must be running.
  webServer: isCI
    ? {
        command: 'npm run start',
        url: 'http://localhost:3000',
        reuseExistingServer: false,
        timeout: 120000,
        env: {
          DATABASE_URL: process.env.DATABASE_URL ?? '',
          DIRECT_URL: process.env.DIRECT_URL ?? '',
          GOOGLE_BOOKS_API_KEY: process.env.GOOGLE_BOOKS_API_KEY ?? '',
        },
      }
    : undefined,
})
