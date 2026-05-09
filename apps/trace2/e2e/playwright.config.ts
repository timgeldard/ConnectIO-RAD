import { defineConfig } from '@playwright/test'
import base from '../../../playwright.config'

/**
 * Playwright config for Trace2 E2E tests.
 * Sets APP_ENV=test to engage shared-auth dev-mode bypass (no JWKS required).
 * Backend: uvicorn on :8002, Frontend: Vite on :5202.
 */
export default defineConfig({
  ...base,
  testDir: './tests',
  // Live trace tests need more time for recursive lineage queries.
  timeout: 45_000,
  webServer: [
    {
      command: 'uv run --no-sync --package trace2-backend uvicorn trace2_backend.main:app --port 8002',
      url: 'http://localhost:8002/health',
      reuseExistingServer: !process.env.CI,
      timeout: 90_000,
      env: { APP_ENV: 'test' },
    },
    {
      command: 'vite --port 5202',
      url: 'http://localhost:5202',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      cwd: 'apps/trace2/frontend',
      env: { VITE_BASE_PATH: '/' },
    },
  ],
  use: {
    ...base.use,
    baseURL: 'http://localhost:5202',
  },
})
