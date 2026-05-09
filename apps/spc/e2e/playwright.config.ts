import { defineConfig } from '@playwright/test'
import base from '../../../playwright.config'

/**
 * Playwright config for SPC E2E tests.
 * Sets APP_ENV=test to engage shared-auth dev-mode bypass (no JWKS required).
 * Backend: uvicorn on :8000, Frontend: Vite on :5201.
 */
export default defineConfig({
  ...base,
  testDir: './tests',
  webServer: [
    {
      command: 'uv run --no-sync --package spc-backend uvicorn spc_backend.main:app --port 8000',
      url: 'http://localhost:8000/health',
      reuseExistingServer: !process.env.CI,
      timeout: 90_000,
      env: { APP_ENV: 'test' },
    },
    {
      command: 'vite --port 5201',
      url: 'http://localhost:5201',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      cwd: 'apps/spc/frontend',
      env: { VITE_BASE_PATH: '/' },
    },
  ],
  use: {
    ...base.use,
    baseURL: 'http://localhost:5201',
  },
})
