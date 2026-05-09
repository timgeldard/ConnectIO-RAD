import { defineConfig } from '@playwright/test'
import base from '../../../playwright.config'

/**
 * Playwright config for Warehouse360 E2E tests.
 * Sets APP_ENV=test to engage shared-auth dev-mode bypass (no JWKS required).
 * Backend: uvicorn on :8004, Frontend: Vite on :5200.
 */
export default defineConfig({
  ...base,
  testDir: './tests',
  webServer: [
    {
      command: 'PYTHONPATH=apps/warehouse360/backend uv run --no-sync --package warehouse360-backend uvicorn warehouse360_backend.main:app --port 8004',
      url: 'http://localhost:8004/health',
      reuseExistingServer: !process.env.CI,
      timeout: 90_000,
      env: { APP_ENV: 'test' },
    },
    {
      command: 'vite --port 5200',
      url: 'http://localhost:5200',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      cwd: 'apps/warehouse360/frontend',
      env: { VITE_BASE_PATH: '/' },
    },
  ],
  use: {
    ...base.use,
    baseURL: 'http://localhost:5200',
  },
})
