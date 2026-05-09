import { defineConfig } from '@playwright/test'
import base from '../../../playwright.config'

/**
 * Playwright config for Platform shell E2E tests.
 * Sets APP_ENV=test to engage shared-auth dev-mode bypass (no JWKS required).
 * Backend: uvicorn on :8006, Frontend: Vite on :5203.
 */
export default defineConfig({
  ...base,
  testDir: './tests',
  webServer: [
    {
      command: 'PYTHONPATH=apps/platform uv run --no-sync --package platform-backend uvicorn backend.main:app --port 8006',
      url: 'http://localhost:8006/health',
      reuseExistingServer: !process.env.CI,
      timeout: 90_000,
      env: { APP_ENV: 'test' },
    },
    {
      command: 'vite --port 5203',
      url: 'http://localhost:5203',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      cwd: 'apps/platform/frontend',
      env: { VITE_BASE_PATH: '/' },
    },
  ],
  use: {
    ...base.use,
    baseURL: 'http://localhost:5203',
  },
})
