import { defineConfig, devices } from '@playwright/test'

/**
 * Workspace-root base config — never run directly.
 * Each app extends this via spread: `{ ...base, testDir: './tests', webServer: {...} }`
 *
 * Auth: Databricks Apps proxy injects x-forwarded-access-token from the user's
 * OAuth session. In CI we inject a service-principal PAT via E2E_DATABRICKS_TOKEN.
 * In local / PR runs we set E2E_MOCK_AUTH=1 and the backend bypasses auth.
 */
export default defineConfig({
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [['blob'], ['github']]
    : [['html', { open: 'never' }]],

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    extraHTTPHeaders: {
      'x-forwarded-access-token': process.env.E2E_DATABRICKS_TOKEN ?? 'e2e-dev-token',
    },
  },

  // Browser matrix: Chromium, Firefox (on-site teams), and Mobile Chrome (dispensary tablets).
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'mobile-tablet',
      use: { ...devices['Galaxy Tab S4'] },
    },
  ],
})
