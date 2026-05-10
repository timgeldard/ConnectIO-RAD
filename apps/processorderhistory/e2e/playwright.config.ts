import { defineConfig } from '@playwright/test'
import base from '../../../playwright.config'

/**
 * Playwright config for Process Order History (POH) E2E tests.
 * Sets APP_ENV=test to engage shared-auth dev-mode bypass.
 * Backend: uvicorn on :8008, Frontend: Vite on :5204.
 */
export default defineConfig({
  ...base,
  testDir: './tests',
  webServer: [
    {
      command: 'uv run --no-sync --package processorderhistory-backend uvicorn processorderhistory_backend.main:app --port 8008',
      url: 'http://localhost:8008/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 90_000,
      env: { APP_ENV: 'test' },
    },
    {
      command: 'vite --port 5204',
      url: 'http://localhost:5204',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      cwd: 'apps/processorderhistory/frontend',
      env: { VITE_BASE_PATH: '/' },
    },
  ],
  use: {
    ...base.use,
    baseURL: 'http://localhost:5204',
  },
})
