import { defineConfig } from '@playwright/test'
import base from '../../../playwright.config'

/**
 * Playwright config for Environmental Monitoring (EnvMon) E2E tests.
 * Sets APP_ENV=test to engage shared-auth dev-mode bypass.
 * Backend: uvicorn on :8010, Frontend: Vite on :5205.
 */
export default defineConfig({
  ...base,
  testDir: './tests',
  webServer: [
    {
      command: 'uv run --no-sync --package envmon-backend uvicorn envmon_backend.main:app --port 8010',
      url: 'http://localhost:8010/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 90_000,
      env: { APP_ENV: 'test' },
    },
    {
      command: 'vite --port 5205',
      url: 'http://localhost:5205',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      cwd: 'apps/envmon/frontend',
      env: { VITE_BASE_PATH: '/' },
    },
  ],
  use: {
    ...base.use,
    baseURL: 'http://localhost:5205',
  },
})
